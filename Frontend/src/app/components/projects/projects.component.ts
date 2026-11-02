import { Component, OnInit, OnDestroy, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { AnnouncementService, AnnouncementListItem } from '../../services/announcement.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { StatusChipComponent } from '../../ui/status-chip/status-chip.component';
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
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    FormsModule,
    NavbarComponent,
    PageHeaderComponent,
    EmptyStateComponent,
    SkeletonRowsComponent,
    StatusChipComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="dashboard-container">
      <app-page-header [crumbs]="['Workspace']" title="Company news"
                       subtitle="Announcements, attendance, birthdays and weather"></app-page-header>

      <!-- Information Widgets -->
      <div class="widgets-grid">

        <!-- Company Announcements -->
        <mat-card class="widget announcement-widget">
          <mat-card-header>
            <div class="widget-icon" style="background: var(--color-primary-soft); color: var(--color-primary);">
              <mat-icon>campaign</mat-icon>
            </div>
            <mat-card-title>Company Announcements</mat-card-title>
            <mat-card-subtitle style="color: var(--color-text-2); margin-top: 4px;">Latest updates and news</mat-card-subtitle>
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
                        <app-status-chip status="Urgent" tone="danger"></app-status-chip>
                      } @else if (announcement.priority === 'High') {
                        <app-status-chip status="High" tone="warn"></app-status-chip>
                      } @else {
                        <app-status-chip status="Info" tone="info"></app-status-chip>
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
                <app-empty-state icon="campaign" title="No announcements right now"
                                 message="Company announcements show up here once they are posted." [compact]="true"></app-empty-state>
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
            <div class="widget-icon" style="background: var(--color-cat-amber-soft); color: var(--color-cat-amber);">
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
                <app-skeleton-rows [rows]="3" [avatar]="false"></app-skeleton-rows>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <!-- Image Slideshow -->
        @if (slideshowImageUrls.length > 0) {
          <mat-card class="widget quote-widget image-mode">
            @if (frontSlideUrl) {
              <img class="slideshow-image" [class.visible]="showFront" [src]="frontSlideUrl"
                   alt="" decoding="async" (error)="onSlideError()" />
            }
            @if (backSlideUrl) {
              <img class="slideshow-image" [class.visible]="!showFront" [src]="backSlideUrl"
                   alt="" decoding="async" (error)="onSlideError()" />
            }
          </mat-card>
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

    .spacer {
      flex: 1 1 auto;
    }

    .dashboard-container {
      padding: var(--space-5) var(--space-6) var(--space-8);
      max-width: 1400px;
      margin: 0 auto;
      background: transparent;
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
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .widget:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-md);
    }

    .widget ::ng-deep .mat-mdc-card-header {
      padding: 20px;
      background: var(--color-surface-2);
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
      color: inherit;
      font-size: var(--text-3xl);
      width: 24px;
      height: 24px;
    }

    .widget ::ng-deep .mat-mdc-card-title {
      font-size: 1.3rem;
      font-weight: 600;
      color: var(--color-text);
      margin: 0;
    }

    .widget ::ng-deep .mat-mdc-card-content {
      padding: 20px;
    }

    /* Company Announcements Widget */
    .announcement-widget {
      grid-column: span 2;
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
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-line);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .announcement-item::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 5px;
      background: var(--color-primary);
      transition: width 0.3s;
    }

    .announcement-item.high-priority {
      background: var(--color-danger-soft);
    }

    .announcement-item.high-priority::before {
      background: var(--color-danger);
    }

    .announcement-item.normal-priority {
      background: var(--color-primary-soft);
    }

    .announcement-item.normal-priority::before {
      background: var(--color-primary);
    }

    .announcement-item:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-md);
      border-color: var(--color-primary);
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
      background: var(--color-primary-soft);
      border-radius: 12px;
    }

    .announcement-icon-badge mat-icon {
      color: var(--color-primary);
      font-size: var(--text-3xl);
      width: 24px;
      height: 24px;
    }

    .announcement-icon-badge.high-priority-badge {
      background: var(--color-danger-soft);
      animation: pulse 2s infinite;
    }

    .announcement-icon-badge.high-priority-badge mat-icon {
      color: var(--color-danger);
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
      color: var(--color-text);
      font-size: var(--text-lg);
      font-weight: 700;
      line-height: 1.4;
      flex: 1;
    }

    .announcement-text {
      margin: 0;
      color: var(--color-text-2);
      font-size: var(--text-md);
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
      font-size: var(--text-sm);
      color: var(--color-text-3);
      font-weight: 500;
      padding: 6px 12px;
      background: var(--color-surface-2);
      border-radius: 8px;
    }

    .announcement-meta mat-icon {
      font-size: var(--text-xl);
      width: 18px;
      height: 18px;
      opacity: 0.8;
    }

    /* Early Birds Today Widget */
    .earliest-employee-widget {
      grid-column: span 1;
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--text-md);
      font-weight: 600;
      color: var(--color-ok);
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--color-ok);
    }

    .section-label.late {
      color: var(--color-warn);
      border-bottom: 2px solid var(--color-warn);
    }

    .section-label mat-icon {
      font-size: var(--text-2xl);
      width: 20px;
      height: 20px;
    }

    .section-divider {
      height: 1px;
      background: var(--color-line);
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
      background: var(--color-surface-2);
      border-radius: 8px;
      transition: all 0.2s;
    }

    .early-bird-item:hover {
      transform: translateX(4px);
      background: var(--color-surface-3);
    }

    .bird-photo {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .bird-photo.late {
      background: var(--color-warn-soft);
      color: var(--color-warn);
    }

    .bird-photo mat-icon {
      font-size: var(--text-4xl);
      width: 32px;
      height: 32px;
      color: inherit;
    }

    .bird-info {
      flex: 1;
    }

    .bird-info h4 {
      margin: 0 0 4px 0;
      font-size: var(--text-md);
      font-weight: 600;
      color: var(--color-text);
    }

    .bird-time {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-ok);
    }

    .bird-time.late {
      color: var(--color-warn);
    }

    .bird-time mat-icon {
      font-size: var(--text-lg);
      width: 16px;
      height: 16px;
      color: inherit;
    }

    .earliest-employee-container {
      text-align: center;
    }

    .earliest-photo {
      width: 100px;
      height: 100px;
      margin: 0 auto 16px;
      border-radius: 50%;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .earliest-photo mat-icon {
      font-size: 70px;
      width: 70px;
      height: 70px;
      color: inherit;
    }

    .earliest-employee-container h3 {
      margin: 0 0 8px 0;
      font-size: var(--text-2xl);
      font-weight: 600;
      color: var(--color-text);
    }

    /* Hero Card (Rotating Welcome/Birthday) */
    .hero-card {
      grid-column: span 1;
      background: var(--color-primary);
      color: var(--color-on-primary);
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

    .welcome-hero,
    .birthday-hero,
    .upcoming-hero {
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
      color: var(--color-on-primary);
    }

    .hero-content h2 {
      font-size: var(--text-3xl);
      font-weight: 700;
      margin: 0 0 16px 0;
      color: var(--color-on-primary);
    }

    .hero-photo {
      width: 90px;
      height: 90px;
      margin: 0 auto 12px;
      border-radius: 50%;
      background: var(--color-primary-hover);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow-md);
      border: 3px solid var(--color-surface);
    }

    .hero-photo.birthday-glow {
      animation: glow 2s ease-in-out infinite;
    }

    @keyframes glow {
      0%, 100% {
        box-shadow: var(--shadow-md);
      }
      50% {
        box-shadow: var(--shadow-lg);
      }
    }

    .hero-photo mat-icon {
      font-size: 60px;
      width: 60px;
      height: 60px;
      color: var(--color-on-primary);
    }

    .hero-content h3 {
      font-size: var(--text-2xl);
      font-weight: 600;
      margin: 0 0 6px 0;
      color: var(--color-on-primary);
    }

    .hero-role {
      font-size: var(--text-lg);
      color: var(--color-on-primary);
      opacity: 0.9;
      margin: 0 0 3px 0;
      font-weight: 500;
    }

    .hero-department {
      font-size: var(--text-md);
      color: var(--color-on-primary);
      opacity: 0.85;
      margin: 0 0 12px 0;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: var(--color-surface);
      border-radius: 24px;
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-primary);
    }

    .hero-badge mat-icon {
      font-size: var(--text-xl);
      width: 18px;
      height: 18px;
    }

    .birthday-badge {
      background: var(--color-cat-pink-soft);
      color: var(--color-cat-pink);
    }

    .upcoming-badge {
      background: var(--color-cat-amber-soft);
      color: var(--color-cat-amber);
    }

    /* Weather Rotating Card */
    .weather-rotating-card {
      grid-column: span 1;
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
      color: var(--color-primary);
      font-size: var(--text-3xl);
      width: 24px;
      height: 24px;
    }

    .weather-header h3 {
      margin: 0;
      font-size: var(--text-3xl);
      font-weight: 600;
      color: var(--color-text);
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
      color: var(--color-primary);
    }

    .temperature-large {
      font-size: var(--text-4xl);
      font-weight: 700;
      color: var(--color-text);
      margin: 12px 0;
    }

    .weather-condition-text {
      font-size: var(--text-xl);
      color: var(--color-text-2);
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
      background: var(--color-surface-2);
      border-radius: 24px;
      font-size: var(--text-md);
      font-weight: 600;
      color: var(--color-text-2);
    }

    .weather-detail-item mat-icon {
      font-size: var(--text-xl);
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
      background: var(--color-line-strong);
      transition: all 0.3s ease;
    }

    .weather-indicators .indicator.active {
      background: var(--color-primary);
      transform: scale(1.3);
    }

    .weather-loading {
      width: 100%;
      min-height: 180px;
    }

    /* Quote Widget */
    .quote-widget {
      grid-column: span 1;
      background: var(--color-surface-2);
      min-height: 280px;
      display: flex;
      flex-direction: column;
    }

    /* When showing a slideshow image, the picture fills the entire card */
    .quote-widget.image-mode {
      position: relative;
      padding: 0;
      overflow: hidden;
      background: var(--nav-bg);
    }

    .quote-widget.image-mode .slideshow-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      opacity: 0;
      transition: opacity 1200ms ease-in-out;
      will-change: opacity;
    }

    .quote-widget.image-mode .slideshow-image.visible {
      opacity: 1;
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
      iconColor: 'var(--color-danger)',
      title: 'New Company Announcement',
      message: 'Important policy update has been posted',
      time: '10 minutes ago',
      read: false
    },
    {
      id: 2,
      icon: 'cake',
      iconColor: 'var(--color-cat-pink)',
      title: 'Birthday Today',
      message: 'Sarah Johnson from HR is celebrating today!',
      time: '1 hour ago',
      read: false
    },
    {
      id: 3,
      icon: 'group_add',
      iconColor: 'var(--color-ok)',
      title: 'New Employee',
      message: 'Welcome Michael Brown to the Marketing team',
      time: '3 hours ago',
      read: false
    },
    {
      id: 4,
      icon: 'emoji_events',
      iconColor: 'var(--color-cat-amber)',
      title: 'Employee of the Month',
      message: 'Jennifer Smith has been named Employee of the Month',
      time: '1 day ago',
      read: false
    },
    {
      id: 5,
      icon: 'support_agent',
      iconColor: 'var(--color-primary)',
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

  // Quote / image slideshow
  slideshowImageUrls: string[] = [];
  slideshowShowingImage = false;   // false = quote is displayed, true = an image
  slideshowIndex = 0;              // index into slideshowImageUrls
  // Two stacked layers for a seamless crossfade (no background gap)
  frontSlideUrl: string | null = null;
  backSlideUrl: string | null = null;
  showFront = true;                // which layer is currently visible
  private slideshowInterval: any;
  private readonly slideshowImageCount = 50;     // max images to cycle through (randomized)
  private readonly slideshowIntervalMs = 6000;   // time per slide / quote

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

    // Load slideshow images and start the quote/image rotation
    this.loadSlideshowImages();

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
    if (this.slideshowInterval) {
      clearInterval(this.slideshowInterval);
    }
  }

  // Quote / Image Slideshow
  loadSlideshowImages(): void {
    this.apiService.getRandomDashboardImages(this.slideshowImageCount).subscribe({
      next: (res) => {
        const images = (res?.images ?? []) as Array<{ id: number }>;
        this.slideshowImageUrls = images.map(i => this.apiService.getDashboardImageUrl(i.id));
        // Preload in the background so slides appear instantly during rotation
        this.slideshowImageUrls.forEach(url => { const im = new Image(); im.src = url; });
        this.startSlideshow();
      },
      error: () => {
        // No images / error: hide the slideshow widget
        this.slideshowImageUrls = [];
      }
    });
  }

  // If an image fails to load, drop it and move on so the widget never gets stuck
  onSlideError(): void {
    const visibleUrl = this.showFront ? this.frontSlideUrl : this.backSlideUrl;
    if (visibleUrl) {
      this.slideshowImageUrls = this.slideshowImageUrls.filter(u => u !== visibleUrl);
    }
    this.advanceSlide();
  }

  startSlideshow(): void {
    if (this.slideshowInterval) {
      clearInterval(this.slideshowInterval);
    }
    if (this.slideshowImageUrls.length === 0) {
      this.frontSlideUrl = null;
      this.backSlideUrl = null;
      return;
    }

    // Show the first image immediately on the front layer, then rotate
    this.slideshowIndex = 0;
    this.showFront = true;
    this.frontSlideUrl = this.slideshowImageUrls[0];
    this.backSlideUrl = null;

    if (this.slideshowImageUrls.length > 1) {
      this.slideshowInterval = setInterval(() => this.advanceSlide(), this.slideshowIntervalMs);
    }
  }

  advanceSlide(): void {
    if (this.slideshowImageUrls.length === 0) {
      this.frontSlideUrl = null;
      this.backSlideUrl = null;
      return;
    }

    this.slideshowIndex = (this.slideshowIndex + 1) % this.slideshowImageUrls.length;
    const nextUrl = this.slideshowImageUrls[this.slideshowIndex];

    // Load the next image onto the hidden layer, then flip visibility so
    // the two layers crossfade with no gap and no background flash.
    if (this.showFront) {
      this.backSlideUrl = nextUrl;
    } else {
      this.frontSlideUrl = nextUrl;
    }
    this.showFront = !this.showFront;
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

        // Birthdays computed from each employee's ACTUAL date of birth.
        // Employees without a stored DOB are simply excluded (no fabricated data).
        const today = new Date();
        const todayMonth = today.getMonth();
        const todayDay = today.getDate();

        const withDob = employees
          .map(emp => {
            const raw = emp.dateOfBirth || emp.birthday || emp.dob;
            if (!raw) return null;
            const dob = new Date(raw);
            if (isNaN(dob.getTime())) return null;
            // Next occurrence of this birthday from today.
            let next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
            if (next < new Date(today.getFullYear(), todayMonth, todayDay)) {
              next = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
            }
            return { emp, dob, next };
          })
          .filter((x): x is { emp: any; dob: Date; next: Date } => x !== null);

        // Today's birthdays: DOB month/day matches today.
        this.todayBirthdays = withDob
          .filter(x => x.dob.getMonth() === todayMonth && x.dob.getDate() === todayDay)
          .map(x => ({
            id: x.emp.employeeId,
            name: x.emp.fullName,
            department: x.emp.department,
            photoBase64: x.emp.photoBase64
          }));

        // Upcoming birthdays: next 30 days (excluding today), soonest first.
        const in30 = new Date(today);
        in30.setDate(today.getDate() + 30);
        this.upcomingBirthdays = withDob
          .filter(x => {
            const isToday = x.dob.getMonth() === todayMonth && x.dob.getDate() === todayDay;
            return !isToday && x.next <= in30;
          })
          .sort((a, b) => a.next.getTime() - b.next.getTime())
          .slice(0, 6)
          .map(x => ({
            id: x.emp.employeeId,
            name: x.emp.fullName,
            department: x.emp.department,
            date: this.formatUpcomingDate(x.next),
            photoBase64: x.emp.photoBase64
          }));
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
    const token = localStorage.getItem('token');
    fetch(`${environment.apiUrl}/messages/conversations?userId=${this.currentUserId}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        this.recentConversations = data.slice(0, 5); // Show only 5 most recent
      })
      .catch(error => {
        console.error('Error loading conversations:', error);
        this.recentConversations = [];
      });
  }

  loadUnreadCount(): void {
    const token = localStorage.getItem('token');
    fetch(`${environment.apiUrl}/messages/unread-count?userId=${this.currentUserId}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
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
      width: '1100px',
      maxWidth: '95vw',
      maxHeight: '90vh',
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
    EmptyStateComponent,
    StatusChipComponent,
    MatCardModule
  ],
  template: `
    <div class="announcements-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>campaign</mat-icon>
          All Announcements
        </h2>
        <button aria-label="Close" mat-icon-button (click)="dialogRef.close()">
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
                <app-status-chip status="Urgent" tone="danger"></app-status-chip>
              } @else if (selectedAnnouncement.priority === 'High') {
                <app-status-chip status="High priority" tone="warn"></app-status-chip>
              } @else {
                <app-status-chip status="Information" tone="info"></app-status-chip>
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
            <app-empty-state icon="campaign" title="No announcements right now"
                             message="Company announcements show up here once they are posted."></app-empty-state>
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
                          <app-status-chip status="Urgent" tone="danger"></app-status-chip>
                        } @else if (announcement.priority === 'High') {
                          <app-status-chip status="High" tone="warn"></app-status-chip>
                        }
                      </div>
                      <p class="card-preview">{{ announcement.content | slice:0:120 }}{{ announcement.content.length > 120 ? '...' : '' }}</p>
                      <div class="card-meta">
                        <span><mat-icon>person</mat-icon> {{ announcement.createdByName }}</span>
                        <span><mat-icon>event</mat-icon> {{ data.formatDate(announcement.createdAt) }}</span>
                      </div>
                    </div>
                    <div class="card-action">
                      <button aria-label="Read full announcement" mat-icon-button color="primary" matTooltip="Read full announcement">
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
      border-bottom: 1px solid var(--color-line);
      background: var(--color-surface);
      color: var(--color-text);
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
      color: var(--color-text-2);
    }

    .dialog-content {
      padding: 24px;
      overflow-y: auto;
      max-height: calc(90vh - 100px);
    }

    .announcements-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .announcement-card {
      cursor: pointer;
      transition: all 0.2s ease;
      border-left: 4px solid var(--color-line);
    }

    .announcement-card:hover {
      transform: translateX(4px);
      box-shadow: var(--shadow-md);
    }

    .announcement-card.urgent {
      border-left-color: var(--color-danger);
      background: var(--color-danger-soft);
    }

    .announcement-card.high {
      border-left-color: var(--color-warn);
      background: var(--color-warn-soft);
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
      background: var(--color-primary-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .card-icon.urgent {
      background: var(--color-danger-soft);
      color: var(--color-danger);
    }

    .card-icon mat-icon {
      font-size: var(--text-2xl);
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
      color: var(--color-text);
    }

    .card-preview {
      margin: 0 0 12px 0;
      color: var(--color-text-2);
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .card-meta {
      display: flex;
      gap: 16px;
      font-size: 0.8rem;
      color: var(--color-text-3);
    }

    .card-meta span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .card-meta mat-icon {
      font-size: var(--text-md);
      width: 14px;
      height: 14px;
    }

    .card-action {
      display: flex;
      align-items: center;
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
      color: var(--color-primary);
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
      color: var(--color-text);
    }

    .detail-meta {
      display: flex;
      gap: 24px;
      padding: 16px;
      background: var(--color-surface-2);
      border-radius: 8px;
      margin-bottom: 24px;
    }

    .detail-meta span {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--color-text-2);
      font-size: 0.9rem;
    }

    .detail-meta mat-icon {
      font-size: var(--text-xl);
      width: 18px;
      height: 18px;
      color: var(--color-primary);
    }

    .detail-content {
      font-size: 1rem;
      line-height: 1.8;
      color: var(--color-text);
      white-space: pre-wrap;
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