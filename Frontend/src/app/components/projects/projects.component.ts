import { Component, OnInit, OnDestroy, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { AnnouncementService, AnnouncementListItem } from '../../services/announcement.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    FormsModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="dashboard-container">
      <h1>Welcome to Promed Intranet</h1>

      <!-- Information Widgets -->
      <div class="widgets-grid">

        <!-- Company Announcements -->
        <mat-card class="widget announcement-widget">
          <mat-card-header>
            <div class="widget-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <mat-icon>campaign</mat-icon>
            </div>
            <mat-card-title>Company Announcements</mat-card-title>
            <mat-card-subtitle style="color: #666; margin-top: 4px;">Latest updates and news</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="announcements-list">
              @for (announcement of announcements.slice(0, 3); track announcement.announcementId) {
                <div class="announcement-item" [class.high-priority]="announcement.priority === 'Urgent' || announcement.priority === 'High'" [class.normal-priority]="announcement.priority === 'Normal' || announcement.priority === 'Low'">
                  <div class="announcement-icon-badge" [class.high-priority-badge]="announcement.priority === 'Urgent' || announcement.priority === 'High'">
                    <mat-icon>{{ (announcement.priority === 'Urgent' || announcement.priority === 'High') ? 'priority_high' : 'info' }}</mat-icon>
                  </div>
                  <div class="announcement-content">
                    <div class="announcement-header">
                      <h4>{{ announcement.title }}</h4>
                      @if (announcement.priority === 'Urgent') {
                        <mat-chip class="priority-chip urgent-chip">
                          <mat-icon>bolt</mat-icon>
                          Urgent
                        </mat-chip>
                      } @else if (announcement.priority === 'High') {
                        <mat-chip class="priority-chip urgent-chip">
                          <mat-icon>arrow_upward</mat-icon>
                          High
                        </mat-chip>
                      } @else {
                        <mat-chip class="priority-chip normal-chip">
                          <mat-icon>info_outline</mat-icon>
                          Info
                        </mat-chip>
                      }
                    </div>
                    <p class="announcement-text">{{ announcement.content }}</p>
                    <div class="announcement-meta">
                      <span class="date">
                        <mat-icon>event</mat-icon>
                        {{ formatAnnouncementDate(announcement.createdAt) }}
                      </span>
                      <span class="author">
                        <mat-icon>account_circle</mat-icon>
                        {{ announcement.createdByName }}
                      </span>
                    </div>
                  </div>
                </div>
              }
              @if (announcements.length === 0) {
                <div class="no-announcements">
                  <mat-icon>campaign</mat-icon>
                  <p>No announcements at this time</p>
                </div>
              }
            </div>
          </mat-card-content>
          <mat-card-actions>
            <button mat-raised-button color="primary" style="width: 100%; height: 48px; font-weight: 600; border-radius: 12px;" (click)="openAllAnnouncementsDialog()">
              <mat-icon>visibility</mat-icon>
              View All Announcements ({{ announcements.length }})
            </button>
          </mat-card-actions>
        </mat-card>

        <!-- Early Birds & Late Bird Today -->
        <mat-card class="widget earliest-employee-widget">
          <mat-card-header>
            <div class="widget-icon" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);">
              <mat-icon>wb_twilight</mat-icon>
            </div>
            <mat-card-title>Attendance Today</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (earlyBirds.hasEmployees) {
              <!-- Early Birds Section -->
              @if (earlyBirds.earlyBirds.length > 0) {
                <div class="section-label">
                  <mat-icon>wb_sunny</mat-icon>
                  <span>Early Birds</span>
                </div>
                <div class="early-birds-list">
                  @for (employee of earlyBirds.earlyBirds; track employee.employeeId) {
                    <div class="early-bird-item">
                      @if (employee.photoBase64) {
                        <div class="bird-photo" [style.background-image]="'url(data:image/jpeg;base64,' + employee.photoBase64 + ')'" style="background-size: cover; background-position: center;"></div>
                      } @else {
                        <div class="bird-photo">
                          <mat-icon>account_circle</mat-icon>
                        </div>
                      }
                      <div class="bird-info">
                        <h4>{{ employee.fullName }}</h4>
                        <div class="bird-time">
                          <mat-icon>access_time</mat-icon>
                          <span>{{ employee.timeIn }}</span>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- Late Birds Section -->
              @if (earlyBirds.lateBirds && earlyBirds.lateBirds.length > 0) {
                <div class="section-divider"></div>
                <div class="section-label late">
                  <mat-icon>schedule</mat-icon>
                  <span>Late Birds</span>
                </div>
                <div class="early-birds-list">
                  @for (employee of earlyBirds.lateBirds; track employee.employeeId) {
                    <div class="early-bird-item">
                      @if (employee.photoBase64) {
                        <div class="bird-photo late" [style.background-image]="'url(data:image/jpeg;base64,' + employee.photoBase64 + ')'" style="background-size: cover; background-position: center;"></div>
                      } @else {
                        <div class="bird-photo late">
                          <mat-icon>account_circle</mat-icon>
                        </div>
                      }
                      <div class="bird-info">
                        <h4>{{ employee.fullName }}</h4>
                        <div class="bird-time late">
                          <mat-icon>access_time</mat-icon>
                          <span>{{ employee.timeIn }}</span>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            } @else {
              <div class="earliest-employee-container">
                <div class="earliest-photo">
                  <mat-icon>access_time</mat-icon>
                </div>
                <h3>No check-ins yet</h3>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <!-- Hero Card (Rotating: New Members, Birthdays, Upcoming Birthdays) -->
        <mat-card class="widget hero-card">
          <mat-card-content>
            @if (currentHeroCard === 'newMember' && newMembers.length > 0) {
              <!-- Welcome New Member -->
              <div class="hero-content welcome-hero">
                <div class="hero-icon-large">
                  <mat-icon>waving_hand</mat-icon>
                </div>
                <h2>Welcome to the Team!</h2>
                @if (newMembers[currentNewMemberIndex].photoBase64) {
                  <div class="hero-photo" [style.background-image]="'url(data:image/jpeg;base64,' + newMembers[currentNewMemberIndex].photoBase64 + ')'" style="background-size: cover; background-position: center;"></div>
                } @else {
                  <div class="hero-photo">
                    <mat-icon>account_circle</mat-icon>
                  </div>
                }
                <h3>{{ newMembers[currentNewMemberIndex].name }}</h3>
                <p class="hero-role">{{ newMembers[currentNewMemberIndex].role }}</p>
                <p class="hero-department">{{ newMembers[currentNewMemberIndex].department }}</p>
                <div class="hero-badge">
                  <mat-icon>calendar_today</mat-icon>
                  <span>Joined {{ newMembers[currentNewMemberIndex].startDate }}</span>
                </div>
              </div>
            } @else if (currentHeroCard === 'birthday' && todayBirthdays.length > 0) {
              <!-- Happy Birthday -->
              <div class="hero-content birthday-hero">
                <div class="hero-icon-large">
                  <mat-icon>celebration</mat-icon>
                </div>
                <h2>Happy Birthday!</h2>
                @if (todayBirthdays[currentBirthdayIndex].photoBase64) {
                  <div class="hero-photo birthday-glow" [style.background-image]="'url(data:image/jpeg;base64,' + todayBirthdays[currentBirthdayIndex].photoBase64 + ')'" style="background-size: cover; background-position: center;"></div>
                } @else {
                  <div class="hero-photo birthday-glow">
                    <mat-icon>account_circle</mat-icon>
                  </div>
                }
                <h3>{{ todayBirthdays[currentBirthdayIndex].name }}</h3>
                <p class="hero-department">{{ todayBirthdays[currentBirthdayIndex].department }}</p>
                <div class="hero-badge birthday-badge">
                  <mat-icon>cake</mat-icon>
                  <span>Wishing you an amazing day!</span>
                </div>
              </div>
            } @else if (currentHeroCard === 'upcoming' && upcomingBirthdays.length > 0) {
              <!-- Upcoming Birthday -->
              <div class="hero-content upcoming-hero">
                <div class="hero-icon-large">
                  <mat-icon>event</mat-icon>
                </div>
                <h2>Upcoming Birthday</h2>
                @if (upcomingBirthdays[currentUpcomingIndex].photoBase64) {
                  <div class="hero-photo" [style.background-image]="'url(data:image/jpeg;base64,' + upcomingBirthdays[currentUpcomingIndex].photoBase64 + ')'" style="background-size: cover; background-position: center;"></div>
                } @else {
                  <div class="hero-photo">
                    <mat-icon>account_circle</mat-icon>
                  </div>
                }
                <h3>{{ upcomingBirthdays[currentUpcomingIndex].name }}</h3>
                <p class="hero-department">{{ upcomingBirthdays[currentUpcomingIndex].department }}</p>
                <div class="hero-badge upcoming-badge">
                  <mat-icon>calendar_month</mat-icon>
                  <span>{{ upcomingBirthdays[currentUpcomingIndex].date }}</span>
                </div>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <!-- Weather & Time Card (Rotating Locations) -->
        <mat-card class="widget weather-rotating-card">
          <mat-card-content>
            @if (locations.length > 0 && !weatherLoading) {
              <div class="weather-content">
                <div class="weather-header">
                  <mat-icon class="location-icon">location_on</mat-icon>
                  <h3>{{ locations[currentLocationIndex].name }}</h3>
                </div>
                <div class="weather-display">
                  <div class="weather-icon-large">
                    <mat-icon>{{ locations[currentLocationIndex].weatherIcon }}</mat-icon>
                  </div>
                  <div class="temperature-large">{{ locations[currentLocationIndex].temperature }}°C</div>
                  <div class="weather-condition-text">{{ locations[currentLocationIndex].condition }}</div>
                  <div class="weather-details">
                    <div class="weather-detail-item">
                      <mat-icon>air</mat-icon>
                      <span>{{ locations[currentLocationIndex].windSpeed }} km/h</span>
                    </div>
                    <div class="weather-detail-item">
                      <mat-icon>access_time</mat-icon>
                      <span>{{ locations[currentLocationIndex].time }}</span>
                    </div>
                  </div>
                </div>
                <div class="weather-indicators">
                  @for (loc of locations; track loc.id; let i = $index) {
                    <span class="indicator" [class.active]="i === currentLocationIndex"></span>
                  }
                </div>
              </div>
            } @else if (weatherLoading) {
              <div class="weather-loading">
                <mat-spinner diameter="40"></mat-spinner>
                <p>Loading weather...</p>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <!-- Motivational Quote -->
        <mat-card class="widget quote-widget">
          <mat-card-header>
            <div class="widget-icon" style="background: linear-gradient(135deg, #FA709A 0%, #FEE140 100%);">
              <mat-icon>format_quote</mat-icon>
            </div>
            <mat-card-title>Quote of the Day</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="quote-container">
              <mat-icon class="quote-mark">format_quote</mat-icon>
              <p class="quote-text">{{ dailyQuote.text }}</p>
              <p class="quote-author">— {{ dailyQuote.author }}</p>
            </div>
          </mat-card-content>
        </mat-card>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    .spacer {
      flex: 1 1 auto;
    }

    .dashboard-container {
      padding: 80px;
      max-width: 1400px;
      margin: 0 auto;
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    h1 {
      margin-bottom: 24px;
      color: #ffffff;
      font-size: 2.5rem;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
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

    /* Messages Dropdown Styles */
    .messages-dropdown {
      position: absolute;
      top: 60px;
      right: 150px;
      width: 400px;
      max-height: 550px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
      z-index: 1001;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .messages-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .messages-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: white;
    }

    .messages-list {
      flex: 1;
      overflow-y: auto;
      max-height: 400px;
    }

    .no-messages {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #9e9e9e;
      text-align: center;
    }

    .no-messages mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .no-messages button {
      margin-top: 16px;
    }

    .message-item {
      display: flex;
      gap: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid #f0f0f0;
      transition: background-color 0.2s;
      cursor: pointer;
    }

    .message-item:hover {
      background-color: #f5f5f5;
    }

    .message-item.unread {
      background-color: #ede7f6;
    }

    .message-item.unread:hover {
      background-color: #e1d5f0;
    }

    .message-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .message-avatar mat-icon {
      color: white;
      font-size: 24px;
    }

    .message-content {
      flex: 1;
      min-width: 0;
    }

    .message-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .message-sender {
      font-weight: 600;
      font-size: 14px;
      color: #333;
    }

    .unread-badge {
      background: #667eea;
      color: white;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
    }

    .message-preview {
      font-size: 13px;
      color: #666;
      margin: 0 0 4px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .message-time {
      font-size: 11px;
      color: #999;
    }

    .messages-footer {
      padding: 12px 20px;
      border-top: 1px solid #e0e0e0;
      background: #f5f5f5;
      text-align: center;
    }

    /* Widgets Grid */
    .widgets-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 24px;
    }

    @media (max-width: 1400px) {
      .widgets-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 900px) {
      .widgets-grid {
        grid-template-columns: 1fr;
      }
    }

    .widget {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .widget:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }

    .widget ::ng-deep .mat-mdc-card-header {
      padding: 20px;
      background: linear-gradient(135deg, rgba(0, 0, 139, 0.05) 0%, rgba(65, 105, 225, 0.05) 100%);
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .widget-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .widget-icon mat-icon {
      color: white;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .widget ::ng-deep .mat-mdc-card-title {
      font-size: 1.3rem;
      font-weight: 600;
      color: #333;
      margin: 0;
    }

    .widget ::ng-deep .mat-mdc-card-content {
      padding: 20px;
    }

    /* Company Announcements Widget */
    .announcement-widget {
      grid-column: span 2;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%);
    }

    .announcement-widget mat-card-header {
      margin-bottom: 24px;
    }

    .announcements-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .announcement-item {
      display: flex;
      gap: 16px;
      padding: 20px;
      background: white;
      border-radius: 16px;
      border: 2px solid transparent;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .announcement-item::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 5px;
      background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
      transition: width 0.3s;
    }

    .announcement-item.high-priority {
      background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%);
      border-color: rgba(255, 107, 107, 0.2);
    }

    .announcement-item.high-priority::before {
      background: linear-gradient(180deg, #FF6B6B 0%, #FF4757 100%);
    }

    .announcement-item.normal-priority {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border-color: rgba(59, 130, 246, 0.2);
    }

    .announcement-item.normal-priority::before {
      background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
    }

    .announcement-item:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      border-color: rgba(102, 126, 234, 0.3);
    }

    .announcement-item:hover::before {
      width: 8px;
    }

    .announcement-icon-badge {
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .announcement-icon-badge mat-icon {
      color: white;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .announcement-icon-badge.high-priority-badge {
      background: linear-gradient(135deg, #FF6B6B 0%, #FF4757 100%);
      box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
    }

    .announcement-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .announcement-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .announcement-header h4 {
      margin: 0;
      color: #1a1a1a;
      font-size: 17px;
      font-weight: 700;
      line-height: 1.4;
      flex: 1;
    }

    .announcement-text {
      margin: 0;
      color: #4a5568;
      font-size: 14px;
      line-height: 1.7;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .announcement-meta {
      display: flex;
      gap: 20px;
      align-items: center;
      flex-wrap: wrap;
    }

    .announcement-meta span {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.7);
      border-radius: 8px;
    }

    .announcement-meta mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      opacity: 0.8;
    }

    .priority-chip {
      font-size: 12px !important;
      height: 28px !important;
      padding: 0 12px !important;
      font-weight: 600 !important;
      border-radius: 8px !important;
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
    }

    .priority-chip mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin: 0 !important;
    }

    .urgent-chip {
      background: linear-gradient(135deg, #FF6B6B 0%, #FF4757 100%) !important;
      color: white !important;
      box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
    }

    .normal-chip {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
      color: white !important;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }

    /* Early Birds Today Widget */
    .earliest-employee-widget {
      grid-column: span 1;
    }

    /* Late Bird Widget */
    .late-bird-widget {
      grid-column: span 1;
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #FFA500;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #FFD700;
    }

    .section-label.late {
      color: #f5576c;
      border-bottom: 2px solid #f093fb;
    }

    .section-label mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .section-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #ddd, transparent);
      margin: 20px 0;
    }

    .early-birds-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .early-bird-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .early-bird-item:hover {
      transform: translateX(4px);
      background: #e8f4f8;
    }

    .bird-photo {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      flex-shrink: 0;
    }

    .bird-photo.late {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      box-shadow: 0 2px 8px rgba(245, 87, 108, 0.3);
    }

    .bird-photo mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: white;
    }

    .bird-info {
      flex: 1;
    }

    .bird-info h4 {
      margin: 0 0 4px 0;
      font-size: 15px;
      font-weight: 600;
      color: #333;
    }

    .bird-time {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      font-weight: 600;
      color: #FFA500;
    }

    .bird-time.late {
      color: #f5576c;
    }

    .bird-time mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #FFA500;
    }

    .bird-time.late mat-icon {
      color: #f5576c;
    }

    .earliest-employee-container {
      text-align: center;
    }

    .earliest-photo {
      width: 100px;
      height: 100px;
      margin: 0 auto 16px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.3);
    }

    .earliest-photo mat-icon {
      font-size: 70px;
      width: 70px;
      height: 70px;
      color: white;
    }

    .earliest-employee-container h3 {
      margin: 0 0 8px 0;
      font-size: 20px;
      font-weight: 600;
      color: #333;
    }

    /* Hero Card (Rotating Welcome/Birthday) */
    .hero-card {
      grid-column: span 1;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .hero-card mat-card-content {
      width: 100%;
      padding: 24px;
    }

    .hero-content {
      text-align: center;
      animation: fadeIn 0.5s ease-in;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .welcome-hero {
      background: linear-gradient(135deg, rgba(17, 153, 142, 0.1) 0%, rgba(56, 239, 125, 0.1) 100%);
      border-radius: 16px;
      padding: 20px;
    }

    .birthday-hero {
      background: linear-gradient(135deg, rgba(245, 87, 108, 0.1) 0%, rgba(240, 147, 251, 0.1) 100%);
      border-radius: 16px;
      padding: 20px;
    }

    .upcoming-hero {
      background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 165, 0, 0.1) 100%);
      border-radius: 16px;
      padding: 20px;
    }

    .hero-icon-large {
      display: inline-flex;
      margin-bottom: 12px;
    }

    .hero-icon-large mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: white;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
    }

    .hero-content h2 {
      font-size: 26px;
      font-weight: 700;
      margin: 0 0 16px 0;
      color: white;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .hero-photo {
      width: 90px;
      height: 90px;
      margin: 0 auto 12px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      border: 3px solid white;
    }

    .hero-photo.birthday-glow {
      animation: glow 2s ease-in-out infinite;
    }

    @keyframes glow {
      0%, 100% {
        box-shadow: 0 8px 24px rgba(245, 87, 108, 0.5);
      }
      50% {
        box-shadow: 0 8px 32px rgba(245, 87, 108, 0.8);
      }
    }

    .hero-photo mat-icon {
      font-size: 60px;
      width: 60px;
      height: 60px;
      color: white;
    }

    .hero-content h3 {
      font-size: 22px;
      font-weight: 600;
      margin: 0 0 6px 0;
      color: white;
    }

    .hero-role {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.9);
      margin: 0 0 3px 0;
      font-weight: 500;
    }

    .hero-department {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.8);
      margin: 0 0 12px 0;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 24px;
      font-size: 13px;
      font-weight: 600;
      color: white;
      backdrop-filter: blur(10px);
    }

    .hero-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .birthday-badge {
      background: rgba(245, 87, 108, 0.3);
    }

    .upcoming-badge {
      background: rgba(255, 193, 7, 0.3);
    }

    /* Weather Rotating Card */
    .weather-rotating-card {
      grid-column: span 1;
      background: linear-gradient(135deg, #56CCF2 0%, #2F80ED 100%);
      color: white;
      min-height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .weather-rotating-card mat-card-content {
      width: 100%;
      padding: 24px;
    }

    .weather-content {
      text-align: center;
      animation: fadeIn 0.5s ease-in;
    }

    .weather-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 16px;
    }

    .weather-header .location-icon {
      color: white;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .weather-header h3 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: white;
    }

    .weather-display {
      text-align: center;
    }

    .weather-icon-large {
      margin: 12px 0;
    }

    .weather-icon-large mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: white;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
    }

    .temperature-large {
      font-size: 48px;
      font-weight: 700;
      color: white;
      margin: 12px 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .weather-condition-text {
      font-size: 18px;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 16px;
      font-weight: 500;
    }

    .weather-details {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-bottom: 16px;
    }

    .weather-detail-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 24px;
      font-size: 14px;
      font-weight: 600;
      color: white;
      backdrop-filter: blur(10px);
    }

    .weather-detail-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .weather-indicators {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 12px;
    }

    .weather-indicators .indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.4);
      transition: all 0.3s ease;
    }

    .weather-indicators .indicator.active {
      background: white;
      transform: scale(1.3);
    }

    .weather-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      min-height: 180px;
      color: white;
    }

    .weather-loading p {
      margin: 0;
      font-size: 14px;
      opacity: 0.8;
    }

    .weather-loading mat-spinner ::ng-deep circle {
      stroke: white !important;
    }

    .local-time-display {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 24px;
      font-size: 16px;
      font-weight: 600;
      color: white;
      backdrop-filter: blur(10px);
    }

    .local-time-display mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    /* Quote Widget */
    .quote-widget {
      grid-column: span 1;
      background: linear-gradient(135deg, #FA709A 0%, #FEE140 100%);
    }

    .quote-widget mat-card-title {
      color: white;
    }

    .quote-container {
      position: relative;
      padding: 24px;
      text-align: center;
    }

    .quote-mark {
      position: absolute;
      top: 0;
      left: 0;
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: rgba(255, 255, 255, 0.3);
      transform: rotate(180deg);
    }

    .quote-text {
      font-size: 22px;
      font-style: italic;
      color: white;
      line-height: 1.6;
      margin: 0 0 16px 0;
      position: relative;
      z-index: 1;
    }

    .quote-author {
      font-size: 16px;
      color: white;
      font-weight: 600;
      margin: 0;
    }
  `]
})
export class ProjectsComponent implements OnInit, OnDestroy {
  currentUser: any;

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

  // Messages properties
  showMessages: boolean = false;
  unreadMessagesCount: number = 0;
  recentConversations: any[] = [];

  // Get current user ID from auth service
  get currentUserId(): number {
    return this.authService.currentUserValue?.userId || 0;
  }

  // Company Announcements (loaded from database)
  announcements: AnnouncementListItem[] = [];

  // Earliest Employee Today (loaded from database)
  earlyBirds: any = {
    hasEmployees: false,
    earlyBirds: [],
    lateBirds: [],
    totalCheckedIn: 0
  };

  // Hero Card Rotation
  currentHeroCard: 'newMember' | 'birthday' | 'upcoming' = 'newMember';
  currentNewMemberIndex: number = 0;
  currentBirthdayIndex: number = 0;
  currentUpcomingIndex: number = 0;
  private heroRotationInterval: any;
  allEmployees: any[] = [];

  // Weather Card Rotation
  currentLocationIndex: number = 0;
  private weatherRotationInterval: any;

  // Employee Spotlight - Removed (replaced by hero card)

  // New Team Members (will be populated from database - recent hires)
  newMembers: any[] = [];

  // Birthday Announcements (will be populated from database)
  todayBirthdays: any[] = [];

  upcomingBirthdays: any[] = [];

  // Weather & Time for Locations
  locations: any[] = [
    { id: 1, name: 'Durban', temperature: 26, condition: 'Loading...', weatherIcon: 'cloud', time: '--:--', windSpeed: 0 },
    { id: 2, name: 'Cape Town', temperature: 22, condition: 'Loading...', weatherIcon: 'cloud', time: '--:--', windSpeed: 0 },
    { id: 3, name: 'Gqeberha', temperature: 24, condition: 'Loading...', weatherIcon: 'cloud', time: '--:--', windSpeed: 0 },
    { id: 4, name: 'Johannesburg', temperature: 25, condition: 'Loading...', weatherIcon: 'cloud', time: '--:--', windSpeed: 0 }
  ];
  weatherLoading = true;
  private http = inject(HttpClient);

  // Daily Quote
  dailyQuote: any = {
    text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
    author: 'Winston Churchill'
  };

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private announcementService: AnnouncementService,
    private router: Router,
    private dialog: MatDialog
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    // Load announcements from database
    this.loadAnnouncements();

    // Load earliest employee from database
    this.loadEarliestEmployee();

    // Load employees and populate hero card data
    this.loadEmployeesForHeroCard();

    // Start hero card rotation
    this.startHeroRotation();

    // Load weather data from API
    this.loadWeatherData();

    // Start weather card rotation
    this.startWeatherRotation();

    // Load messages
    this.loadRecentConversations();
    this.loadUnreadCount();

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
      this.showNotifications = false;
      this.showMessages = false;
    });
  }

  ngOnDestroy(): void {
    // Clear rotation intervals
    if (this.heroRotationInterval) {
      clearInterval(this.heroRotationInterval);
    }
    if (this.weatherRotationInterval) {
      clearInterval(this.weatherRotationInterval);
    }
  }

  // Hero Card Rotation
  startHeroRotation(): void {
    this.heroRotationInterval = setInterval(() => {
      this.rotateHeroCard();
    }, 5000); // Rotate every 5 seconds
  }

  rotateHeroCard(): void {
    // Determine which cards have content
    const hasNewMembers = this.newMembers.length > 0;
    const hasTodayBirthdays = this.todayBirthdays.length > 0;
    const hasUpcomingBirthdays = this.upcomingBirthdays.length > 0;

    // Current card logic
    if (this.currentHeroCard === 'newMember') {
      if (hasNewMembers && this.currentNewMemberIndex < this.newMembers.length - 1) {
        // Show next new member
        this.currentNewMemberIndex++;
      } else if (hasTodayBirthdays) {
        // Switch to birthday
        this.currentHeroCard = 'birthday';
        this.currentBirthdayIndex = 0;
      } else if (hasUpcomingBirthdays) {
        // Switch to upcoming
        this.currentHeroCard = 'upcoming';
        this.currentUpcomingIndex = 0;
      } else {
        // Loop back to first new member
        this.currentNewMemberIndex = 0;
      }
    } else if (this.currentHeroCard === 'birthday') {
      if (hasTodayBirthdays && this.currentBirthdayIndex < this.todayBirthdays.length - 1) {
        // Show next birthday
        this.currentBirthdayIndex++;
      } else if (hasUpcomingBirthdays) {
        // Switch to upcoming
        this.currentHeroCard = 'upcoming';
        this.currentUpcomingIndex = 0;
      } else if (hasNewMembers) {
        // Switch back to new members
        this.currentHeroCard = 'newMember';
        this.currentNewMemberIndex = 0;
      } else {
        // Loop back to first birthday
        this.currentBirthdayIndex = 0;
      }
    } else if (this.currentHeroCard === 'upcoming') {
      if (hasUpcomingBirthdays && this.currentUpcomingIndex < this.upcomingBirthdays.length - 1) {
        // Show next upcoming
        this.currentUpcomingIndex++;
      } else if (hasNewMembers) {
        // Switch back to new members
        this.currentHeroCard = 'newMember';
        this.currentNewMemberIndex = 0;
      } else if (hasTodayBirthdays) {
        // Switch to birthday
        this.currentHeroCard = 'birthday';
        this.currentBirthdayIndex = 0;
      } else {
        // Loop back to first upcoming
        this.currentUpcomingIndex = 0;
      }
    }
  }

  // Weather Card Rotation
  startWeatherRotation(): void {
    this.weatherRotationInterval = setInterval(() => {
      this.rotateWeatherCard();
    }, 4000); // Rotate every 4 seconds
  }

  rotateWeatherCard(): void {
    if (this.locations.length > 0) {
      this.currentLocationIndex = (this.currentLocationIndex + 1) % this.locations.length;
    }
  }

  // Load weather data from API
  loadWeatherData(): void {
    this.weatherLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/weather`).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.locations = data;
        }
        this.weatherLoading = false;
      },
      error: (error) => {
        console.error('Error loading weather data:', error);
        this.weatherLoading = false;
        // Keep default fallback data
      }
    });
  }

  // Load announcements from database
  loadAnnouncements(): void {
    this.announcementService.getAnnouncements(true, 5).subscribe({
      next: (data) => {
        this.announcements = data;
      },
      error: (error) => {
        console.error('Error loading announcements:', error);
      }
    });
  }

  // Format announcement date
  formatAnnouncementDate(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return d.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Load early birds who clocked in today
  loadEarliestEmployee(): void {
    this.apiService.getEarliestEmployeeToday().subscribe({
      next: (data) => {
        this.earlyBirds = data;
      },
      error: (error) => {
        console.error('Error loading early birds:', error);
        // Keep default state showing "no check-ins yet"
      }
    });
  }

  // Load employees from database and populate hero card data
  loadEmployeesForHeroCard(): void {
    this.apiService.getEmployees().subscribe({
      next: (employees) => {
        this.allEmployees = employees;

        // Get recent hires (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        this.newMembers = employees
          .filter(emp => new Date(emp.hireDate) >= thirtyDaysAgo)
          .sort((a, b) => new Date(b.hireDate).getTime() - new Date(a.hireDate).getTime())
          .slice(0, 5)
          .map(emp => ({
            id: emp.employeeId,
            name: emp.fullName,
            role: emp.position,
            department: emp.department,
            startDate: this.formatDate(emp.hireDate),
            photoBase64: emp.photoBase64
          }));

        // For demo: Use random employees for birthdays
        const shuffled = [...employees].sort(() => 0.5 - Math.random());

        // Today's birthdays (using random 2-3 employees)
        this.todayBirthdays = shuffled.slice(0, 2).map(emp => ({
          id: emp.employeeId,
          name: emp.fullName,
          department: emp.department,
          photoBase64: emp.photoBase64
        }));

        // Upcoming birthdays (using random 4 employees)
        const today = new Date();
        this.upcomingBirthdays = shuffled.slice(2, 6).map((emp, index) => {
          const futureDate = new Date(today);
          futureDate.setDate(today.getDate() + index + 1);
          return {
            id: emp.employeeId,
            name: emp.fullName,
            department: emp.department,
            date: this.formatUpcomingDate(futureDate),
            photoBase64: emp.photoBase64
          };
        });
      },
      error: (error) => {
        console.error('Error loading employees:', error);
      }
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  formatUpcomingDate(date: Date): string {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    }
  }

  // Notification methods
  toggleNotifications(event: Event): void {
    event.stopPropagation();
    this.showNotifications = !this.showNotifications;
    this.showMessages = false; // Close messages when opening notifications
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

  // Messages methods
  toggleMessages(event: Event): void {
    event.stopPropagation();
    this.showMessages = !this.showMessages;
    this.showNotifications = false; // Close notifications when opening messages
    if (this.showMessages) {
      this.loadRecentConversations();
    }
  }

  loadRecentConversations(): void {
    fetch(`${environment.apiUrl}/messages/conversations?userId=${this.currentUserId}`)
      .then(response => response.json())
      .then(data => {
        this.recentConversations = data.slice(0, 5); // Show only 5 most recent
      })
      .catch(error => {
        console.error('Error loading conversations:', error);
        this.recentConversations = [];
      });
  }

  loadUnreadCount(): void {
    fetch(`${environment.apiUrl}/messages/unread-count?userId=${this.currentUserId}`)
      .then(response => response.json())
      .then(count => {
        this.unreadMessagesCount = count;
      })
      .catch(error => {
        console.error('Error loading unread count:', error);
        this.unreadMessagesCount = 0;
      });
  }

  getOtherParticipantName(conv: any): string {
    const otherParticipant = conv.participants?.find((p: any) => p.userId !== this.currentUserId);
    return otherParticipant ? `${otherParticipant.name} ${otherParticipant.surname}` : 'Unknown';
  }

  formatMessageTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  openConversation(conv: any): void {
    this.showMessages = false;
    // TODO: Navigate to full messages view or open chat dialog
    console.log('Opening conversation:', conv.conversationId);
  }

  openNewMessageDialog(): void {
    this.showMessages = false;
    // Navigate to messages page
    this.router.navigate(['/messages']);
  }

  viewAllMessages(): void {
    this.showMessages = false;
    this.router.navigate(['/messages']);
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // Open All Announcements Dialog
  openAllAnnouncementsDialog(): void {
    this.dialog.open(AllAnnouncementsDialogComponent, {
      width: '800px',
      maxHeight: '80vh',
      data: { 
        announcements: this.announcements,
        formatDate: this.formatAnnouncementDate.bind(this)
      }
    });
  }
}

// All Announcements Dialog Component
@Component({
  selector: 'app-all-announcements-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatCardModule
  ],
  template: `
    <div class="announcements-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>campaign</mat-icon>
          All Announcements
        </h2>
        <button mat-icon-button (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        @if (selectedAnnouncement) {
          <!-- Single Announcement View -->
          <div class="announcement-detail">
            <button mat-button (click)="selectedAnnouncement = null" class="back-button">
              <mat-icon>arrow_back</mat-icon>
              Back to all announcements
            </button>
            
            <div class="detail-header">
              <h3>{{ selectedAnnouncement.title }}</h3>
              @if (selectedAnnouncement.priority === 'Urgent') {
                <mat-chip class="priority-chip urgent">
                  <mat-icon>bolt</mat-icon>
                  Urgent
                </mat-chip>
              } @else if (selectedAnnouncement.priority === 'High') {
                <mat-chip class="priority-chip high">
                  <mat-icon>arrow_upward</mat-icon>
                  High Priority
                </mat-chip>
              } @else {
                <mat-chip class="priority-chip normal">
                  <mat-icon>info_outline</mat-icon>
                  Information
                </mat-chip>
              }
            </div>
            
            <div class="detail-meta">
              <span>
                <mat-icon>person</mat-icon>
                {{ selectedAnnouncement.createdByName }}
              </span>
              <span>
                <mat-icon>event</mat-icon>
                {{ data.formatDate(selectedAnnouncement.createdAt) }}
              </span>
              @if (selectedAnnouncement.category) {
                <span>
                  <mat-icon>label</mat-icon>
                  {{ selectedAnnouncement.category }}
                </span>
              }
            </div>
            
            <div class="detail-content">
              {{ selectedAnnouncement.content }}
            </div>
          </div>
        } @else {
          <!-- All Announcements List -->
          @if (data.announcements.length === 0) {
            <div class="no-announcements">
              <mat-icon>campaign</mat-icon>
              <p>No announcements at this time</p>
            </div>
          } @else {
            <div class="announcements-list">
              @for (announcement of data.announcements; track announcement.announcementId) {
                <mat-card class="announcement-card" 
                          [class.urgent]="announcement.priority === 'Urgent'"
                          [class.high]="announcement.priority === 'High'"
                          (click)="viewAnnouncement(announcement)">
                  <div class="card-content">
                    <div class="card-icon" [class.urgent]="announcement.priority === 'Urgent' || announcement.priority === 'High'">
                      <mat-icon>{{ (announcement.priority === 'Urgent' || announcement.priority === 'High') ? 'priority_high' : 'info' }}</mat-icon>
                    </div>
                    <div class="card-details">
                      <div class="card-header">
                        <h4>{{ announcement.title }}</h4>
                        @if (announcement.priority === 'Urgent') {
                          <mat-chip class="priority-chip urgent">Urgent</mat-chip>
                        } @else if (announcement.priority === 'High') {
                          <mat-chip class="priority-chip high">High</mat-chip>
                        }
                      </div>
                      <p class="card-preview">{{ announcement.content | slice:0:120 }}{{ announcement.content.length > 120 ? '...' : '' }}</p>
                      <div class="card-meta">
                        <span><mat-icon>person</mat-icon> {{ announcement.createdByName }}</span>
                        <span><mat-icon>event</mat-icon> {{ data.formatDate(announcement.createdAt) }}</span>
                      </div>
                    </div>
                    <div class="card-action">
                      <button mat-icon-button color="primary" matTooltip="Read full announcement">
                        <mat-icon>chevron_right</mat-icon>
                      </button>
                    </div>
                  </div>
                </mat-card>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .announcements-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: -24px -24px 0 -24px;
    }

    .dialog-header h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-size: 1.5rem;
    }

    .dialog-header button {
      color: white;
    }

    .dialog-content {
      padding: 24px;
      overflow-y: auto;
      max-height: calc(80vh - 100px);
    }

    .announcements-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .announcement-card {
      cursor: pointer;
      transition: all 0.2s ease;
      border-left: 4px solid #e0e0e0;
    }

    .announcement-card:hover {
      transform: translateX(4px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .announcement-card.urgent {
      border-left-color: #f44336;
      background: linear-gradient(90deg, rgba(244,67,54,0.05) 0%, transparent 100%);
    }

    .announcement-card.high {
      border-left-color: #ff9800;
      background: linear-gradient(90deg, rgba(255,152,0,0.05) 0%, transparent 100%);
    }

    .card-content {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 16px;
    }

    .card-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #e3f2fd;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .card-icon.urgent {
      background: linear-gradient(135deg, #ff5252 0%, #f44336 100%);
      color: white;
    }

    .card-icon mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .card-details {
      flex: 1;
      min-width: 0;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .card-header h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #333;
    }

    .card-preview {
      margin: 0 0 12px 0;
      color: #666;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .card-meta {
      display: flex;
      gap: 16px;
      font-size: 0.8rem;
      color: #999;
    }

    .card-meta span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .card-meta mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .card-action {
      display: flex;
      align-items: center;
    }

    .priority-chip {
      font-size: 0.7rem;
      height: 24px;
    }

    .priority-chip.urgent {
      background: #f44336 !important;
      color: white !important;
    }

    .priority-chip.high {
      background: #ff9800 !important;
      color: white !important;
    }

    .priority-chip.normal {
      background: #2196f3 !important;
      color: white !important;
    }

    /* Detail View */
    .announcement-detail {
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .back-button {
      margin-bottom: 16px;
      color: #667eea;
    }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }

    .detail-header h3 {
      margin: 0;
      font-size: 1.5rem;
      color: #333;
    }

    .detail-meta {
      display: flex;
      gap: 24px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-bottom: 24px;
    }

    .detail-meta span {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #666;
      font-size: 0.9rem;
    }

    .detail-meta mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #667eea;
    }

    .detail-content {
      font-size: 1rem;
      line-height: 1.8;
      color: #333;
      white-space: pre-wrap;
    }

    .no-announcements {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: #999;
    }

    .no-announcements mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }
  `]
})
export class AllAnnouncementsDialogComponent {
  selectedAnnouncement: AnnouncementListItem | null = null;

  constructor(
    public dialogRef: MatDialogRef<AllAnnouncementsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { announcements: AnnouncementListItem[], formatDate: (date: Date | string) => string }
  ) {}

  viewAnnouncement(announcement: AnnouncementListItem): void {
    this.selectedAnnouncement = announcement;
  }
}