import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { environment } from '../../../environments/environment';

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
    MatSnackBarModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="calendar-container">
      <div class="calendar-header">
        <button mat-icon-button (click)="previousMonth()">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <h1>{{ monthNames[currentMonth] }} {{ currentYear }}</h1>
        <button mat-icon-button (click)="nextMonth()">
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
                  <div class="birthday-avatar">🎂</div>
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
            <p style="color: white; font-size: 1.1rem; opacity: 0.9;">No events scheduled for this month.</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calendar-container {
      padding: 80px;
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
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
      color: white;
    }

    .calendar-header h1 {
      font-size: 2.5rem;
      font-weight: 600;
      margin: 0;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .calendar-header button {
      color: white;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
    }

    .calendar-header button:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .calendar-header mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .calendar-grid {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 24px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }

    .calendar-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
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
      background: #e0e0e0;
    }

    .calendar-day {
      background: white;
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
      background: #f5f5f5;
      transform: scale(1.02);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10;
    }

    .calendar-day.has-events {
      border-left: 4px solid #4169e1;
    }

    .calendar-day.other-month {
      background: #fafafa;
      opacity: 0.5;
    }

    .calendar-day.today {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      border: 2px solid #2196F3;
    }

    .calendar-day.today .day-number {
      background: #2196F3;
      color: white;
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
      color: #333;
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
      background: #e3f2fd;
      border-radius: 4px;
      font-size: 10px;
      color: #1976d2;
    }

    .task-indicator mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    .task-indicator.completed {
      background: #e8f5e9;
      color: #388e3c;
      text-decoration: line-through;
    }

    .task-indicator.pending {
      background: #fff3e0;
      color: #f57c00;
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
      color: white;
    }

    .section-title.birthday-title {
      color: #fce4ec;
    }

    .section-title.birthday-title mat-icon {
      color: #E91E63;
    }

    .birthdays-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .birthday-card {
      background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%);
      border-radius: 12px;
      transition: all 0.3s ease;
      border-left: 4px solid #E91E63;
    }

    .birthday-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(233, 30, 99, 0.3);
    }

    .birthday-card mat-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .birthday-avatar {
      font-size: 32px;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      border-radius: 50%;
    }

    .birthday-info {
      flex: 1;
    }

    .birthday-card mat-card-title {
      color: #880e4f;
      font-size: 1.1rem;
      margin-bottom: 4px;
    }

    .birthday-card mat-card-subtitle {
      color: #ad1457;
    }

    .department-badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 12px;
      font-size: 12px;
      color: #880e4f;
    }

    .tasks-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .task-card {
      background: white;
      border-radius: 12px;
      transition: all 0.3s ease;
    }

    .task-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }

    .task-card.completed {
      opacity: 0.7;
      background: #f5f5f5;
    }

    .task-card.pending {
      border-left: 4px solid #ff9800;
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
      color: #999;
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
      font-size: 11px;
      font-weight: 500;
    }

    .priority-low { background: #e3f2fd; color: #1976d2; }
    .priority-normal { background: #e8f5e9; color: #388e3c; }
    .priority-high { background: #fff3e0; color: #f57c00; }
    .priority-urgent { background: #ffebee; color: #d32f2f; }

    .status-pending { background: #fff3e0; color: #f57c00; }
    .status-accepted { background: #e3f2fd; color: #1976d2; }
    .status-completed { background: #e8f5e9; color: #388e3c; }

    .assigned-by {
      font-size: 12px;
      color: #666;
    }

    .task-description {
      font-size: 13px;
      color: #666;
      margin-top: 8px;
    }

    .events-sidebar {
      max-width: 1400px;
      margin: 32px auto 0;
      padding: 0 24px;
      color: white;
    }

    .events-sidebar h2 {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 24px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
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
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }

    .event-card mat-card-title {
      font-size: 1.3rem;
      font-weight: 600;
      color: #1e90ff;
    }

    .event-card mat-card-subtitle {
      color: #4169e1;
      font-size: 1rem;
      margin-top: 4px;
    }

    .event-details {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 8px 0;
      color: #666;
    }

    .event-details mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #4169e1;
    }

    .event-card p {
      margin: 16px 0 0 0;
      color: #555;
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
      color: '#DC143C'
    },
    {
      id: 102,
      title: 'Human Rights Day',
      date: new Date(2026, 2, 21), // March 21, 2026 (Saturday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: '#DC143C'
    },
    {
      id: 103,
      title: 'Good Friday',
      date: new Date(2026, 3, 3), // April 3, 2026 (Friday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: '#DC143C'
    },
    {
      id: 104,
      title: 'Family Day',
      date: new Date(2026, 3, 6), // April 6, 2026 (Monday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: '#DC143C'
    },
    {
      id: 105,
      title: 'Freedom Day',
      date: new Date(2026, 3, 27), // April 27, 2026 (Monday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: '#DC143C'
    },
    {
      id: 106,
      title: "Workers' Day",
      date: new Date(2026, 4, 1), // May 1, 2026 (Friday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: '#DC143C'
    },
    {
      id: 107,
      title: 'Youth Day',
      date: new Date(2026, 5, 16), // June 16, 2026 (Tuesday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: '#DC143C'
    },
    {
      id: 108,
      title: "National Women's Day",
      date: new Date(2026, 7, 9), // August 9, 2026 (Sunday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: '#DC143C'
    },
    {
      id: 109,
      title: "Public Holiday (Women's Day observed)",
      date: new Date(2026, 7, 10), // August 10, 2026 (Monday)
      time: 'All Day',
      location: 'Public Holiday',
      description: "Public Holiday observed for National Women's Day",
      color: '#DC143C'
    },
    {
      id: 110,
      title: 'Heritage Day',
      date: new Date(2026, 8, 24), // September 24, 2026 (Thursday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: '#DC143C'
    },
    {
      id: 111,
      title: 'Day of Reconciliation',
      date: new Date(2026, 11, 16), // December 16, 2026 (Wednesday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: '#DC143C'
    },
    {
      id: 112,
      title: 'Christmas Day',
      date: new Date(2026, 11, 25), // December 25, 2026 (Friday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: '#DC143C'
    },
    {
      id: 113,
      title: 'Day of Goodwill',
      date: new Date(2026, 11, 26), // December 26, 2026 (Saturday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: '#DC143C'
    },
    // Regular events
    {
      id: 1,
      title: 'Team Meeting',
      date: new Date(2025, 10, 15),
      time: '10:00 AM - 11:00 AM',
      location: 'Conference Room A',
      description: 'Monthly team sync-up and planning session',
      color: '#4CAF50'
    },
    {
      id: 2,
      title: 'Project Deadline',
      date: new Date(2025, 10, 20),
      time: '5:00 PM',
      location: 'Development Team',
      description: 'E-Commerce platform final delivery',
      color: '#F44336'
    },
    {
      id: 3,
      title: 'Company Holiday',
      date: new Date(2025, 10, 28),
      time: 'All Day',
      location: 'Company-wide',
      description: 'Thanksgiving Day - Office Closed',
      color: '#FF9800'
    },
    {
      id: 4,
      title: 'Training Session',
      date: new Date(2025, 10, 18),
      time: '2:00 PM - 4:00 PM',
      location: 'Training Room',
      description: 'New software tools and best practices',
      color: '#2196F3'
    },
    {
      id: 5,
      title: 'Client Presentation',
      date: new Date(2025, 10, 22),
      time: '3:00 PM - 4:30 PM',
      location: 'Board Room',
      description: 'Q4 results and future roadmap',
      color: '#9C27B0'
    }
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private dialog: MatDialog,
    private http: HttpClient,
    private snackBar: MatSnackBar
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
    
    this.http.get<TodoTask[]>(`${environment.apiUrl}/api/todo/calendar/${this.currentUserId}?month=${this.currentMonth + 1}&year=${this.currentYear}`)
      .subscribe({
        next: (tasks) => {
          this.todoTasks = tasks;
          this.generateCalendar(); // Regenerate calendar with tasks
        },
        error: (err) => console.error('Error loading tasks:', err)
      });
  }

  loadBirthdays(): void {
    this.http.get<UserBirthday[]>(`${environment.apiUrl}/api/users/birthdays?month=${this.currentMonth + 1}`)
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
        title: `🎂 ${birthday.name} ${birthday.surname || ''}'s Birthday`,
        date: new Date(this.currentYear, birthDate.getMonth(), birthDate.getDate()),
        time: 'All Day',
        location: birthday.departmentName || 'Company',
        description: `Happy Birthday to ${birthday.name} ${birthday.surname || ''}!`,
        color: '#E91E63' // Pink for birthdays
      });
    });
  }

  loadMeetings(): void {
    const startDate = new Date(this.currentYear, this.currentMonth, 1);
    const endDate = new Date(this.currentYear, this.currentMonth + 2, 0);
    
    this.http.get<any[]>(`${environment.apiUrl}/api/meetings/calendar?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
      .subscribe({
        next: (meetings) => {
          // Remove existing meeting events
          this.upcomingEvents = this.upcomingEvents.filter(e => !e.title.startsWith('📅'));
          
          // Add meeting events
          meetings.forEach((meeting, index) => {
            const meetingDate = new Date(meeting.start);
            this.upcomingEvents.push({
              id: 3000 + index,
              title: `📅 ${meeting.title}`,
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

    this.http.post(`${environment.apiUrl}/api/todo/${task.id}/complete`, {}).subscribe({
      next: () => {
        this.snackBar.open('Task completed!', 'Close', { duration: 3000 });
        this.loadTasks();
      },
      error: (err) => {
        console.error('Error completing task:', err);
        this.snackBar.open('Error completing task', 'Close', { duration: 3000 });
      }
    });
  }

  openDayEvents(day: any): void {
    if (day.events.length > 0) {
      this.dialog.open(DayEventsDialogComponent, {
        width: '600px',
        data: {
          date: day.date,
          events: day.events
        }
      });
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

// Dialog Component for showing day events
@Component({
  selector: 'app-day-events-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
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
        <button mat-icon-button mat-dialog-close class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
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
      </mat-dialog-content>

      <mat-dialog-actions>
        <button mat-flat-button mat-dialog-close class="modern-close-btn">
          <mat-icon>check_circle</mat-icon>
          Got it
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .modern-dialog-container {
      position: relative;
      background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 32px 32px 24px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: -24px -24px 0 -24px;
      border-radius: 12px 12px 0 0;
      position: relative;
      overflow: hidden;
    }

    .dialog-header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 300px;
      height: 300px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
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
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    .icon-wrapper mat-icon {
      font-size: 32px;
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
      background: rgba(255, 255, 255, 0.2);
      color: white;
      position: relative;
      z-index: 1;
      transition: all 0.3s ease;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: rotate(90deg);
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
      background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
      border-radius: 12px;
      margin-bottom: 24px;
      border-left: 4px solid #667eea;
    }

    .events-count mat-icon {
      color: #667eea;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .events-count span {
      font-weight: 600;
      color: #333;
      font-size: 1rem;
    }

    .events-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .event-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
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
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
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
      color: white;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .event-badge mat-icon {
      font-size: 24px;
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
      color: #1a1a1a;
      letter-spacing: -0.3px;
    }

    .event-time {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 100%);
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      color: #555;
    }

    .event-time mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .event-details {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-top: 20px;
      border-top: 2px dashed #e0e0e0;
    }

    .detail-row {
      display: flex;
      gap: 16px;
    }

    .detail-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #f5f5f5 0%, #ececec 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .detail-icon mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #666;
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
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .detail-value {
      font-size: 1rem;
      color: #333;
      line-height: 1.5;
      font-weight: 500;
    }

    mat-dialog-actions {
      padding: 24px 32px;
      background: linear-gradient(180deg, transparent 0%, #f8f9ff 100%);
      margin: 0 -24px -24px -24px;
      display: flex;
      justify-content: center;
      border-top: 1px solid #e0e0e0;
    }

    .modern-close-btn {
      min-width: 160px;
      height: 48px;
      font-weight: 700;
      font-size: 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
      transition: all 0.3s ease;
    }

    .modern-close-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4);
    }

    .modern-close-btn mat-icon {
      margin-right: 8px;
    }

    ::-webkit-scrollbar {
      width: 10px;
    }

    ::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb {
      background: #4169e1;
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #1e90ff;
    }
  `]
})
export class DayEventsDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { date: Date; events: any[] }
  ) {}
}


