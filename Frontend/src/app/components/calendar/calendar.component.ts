import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatBadgeModule,
    MatMenuModule,
    MatDialogModule
  ],
  template: `
    <div class="calendar-container">
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

        <button mat-icon-button [matBadge]="notificationCount" matBadgeColor="warn" [matBadgeHidden]="notificationCount === 0">
          <mat-icon>notifications</mat-icon>
        </button>
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
                 [class.has-events]="day.events.length > 0"
                 [class.clickable]="day.events.length > 0"
                 (click)="openDayEvents(day)">
              <div class="day-number">{{ day.day }}</div>
              <div class="day-events">
                @for (event of day.events; track event.id) {
                  <div class="event-indicator" [style.background]="event.color" [title]="event.title"></div>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <div class="events-sidebar">
        <h2>Upcoming Events</h2>
        <div class="events-list">
          @for (event of upcomingEvents; track event.id) {
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
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calendar-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
      padding-bottom: 40px;
    }

    .spacer {
      flex: 1;
    }

    mat-toolbar {
      background: linear-gradient(135deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
      color: white;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    mat-toolbar h2 {
      font-weight: 600;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
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
      background: linear-gradient(135deg, #00008B 0%, #4169e1 100%);
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

    .calendar-day:hover .event-indicator {
      height: 8px;
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
      color: #00008B;
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

  monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  upcomingEvents = [
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
    private dialog: MatDialog
  ) {
    const today = new Date();
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
  }

  ngOnInit(): void {
    this.generateCalendar();
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
        events: []
      });
    }

    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(this.currentYear, this.currentMonth, day);
      const isToday = date.toDateString() === today.toDateString();
      const dayEvents = this.upcomingEvents.filter(event =>
        event.date.toDateString() === date.toDateString()
      );

      this.calendarDays.push({
        day,
        date,
        isCurrentMonth: true,
        isToday,
        events: dayEvents
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
        events: []
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
    this.generateCalendar();
  }

  nextMonth(): void {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.generateCalendar();
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
      background: #00008B;
    }
  `]
})
export class DayEventsDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { date: Date; events: any[] }
  ) {}
}
