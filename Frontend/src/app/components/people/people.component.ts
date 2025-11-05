import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { AuthService } from '../../services/auth.service';
import { AttendanceService } from '../../services/attendance.service';
import { Employee, AttendanceMetrics } from '../../models/attendance.model';
import { interval, Subscription, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

// Hardcoded development environment for debugging
const environment = {
  production: false,
  apiUrl: 'http://localhost:5143/api',
  signalRUrl: 'http://localhost:5143'
};

@Component({
  selector: 'app-people',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatBadgeModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule
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

    <div class="attendance-container">
      <div class="header-section">
        <div class="title-row">
          <h1>
            <mat-icon>access_time</mat-icon>
            Employee Attendance Monitor
          </h1>
          <div class="header-actions">
            <button mat-raised-button color="primary" (click)="downloadWeeklyReport()" class="export-btn">
              <mat-icon>download</mat-icon>
              Weekly Report
            </button>
            <button mat-raised-button color="accent" (click)="downloadMonthlyReport()" class="export-btn">
              <mat-icon>download</mat-icon>
              Monthly Report
            </button>
            <div class="refresh-info">
              <mat-icon>autorenew</mat-icon>
              <span>Auto-refresh: 60s | Last updated: {{ lastUpdate | date:'short' }}</span>
            </div>
          </div>
        </div>

        <!-- Metrics Dashboard -->
        @if (metrics) {
          <div class="metrics-grid">
            <mat-card class="metric-card total">
              <mat-icon>people</mat-icon>
              <div class="metric-content">
                <h2>{{ metrics.totalEmployees }}</h2>
                <p>Total Employees</p>
              </div>
            </mat-card>

            <mat-card class="metric-card present">
              <mat-icon>check_circle</mat-icon>
              <div class="metric-content">
                <h2>{{ metrics.presentCount }}</h2>
                <p>Present ({{ metrics.attendanceRate | number:'1.1-1' }}%)</p>
              </div>
            </mat-card>

            <mat-card class="metric-card absent">
              <mat-icon>cancel</mat-icon>
              <div class="metric-content">
                <h2>{{ metrics.absentCount }}</h2>
                <p>Absent</p>
              </div>
            </mat-card>

            <mat-card class="metric-card late">
              <mat-icon>schedule</mat-icon>
              <div class="metric-content">
                <h2>{{ metrics.lateCount }}</h2>
                <p>Late Arrivals</p>
              </div>
            </mat-card>
          </div>
        }
      </div>

      <!-- Department Breakdown -->
      @if (metrics && metrics.departmentBreakdown.length > 0) {
        <div class="department-section">
          <h2>
            <mat-icon>business</mat-icon>
            Department Breakdown
          </h2>
          <div class="department-grid">
            @for (dept of metrics.departmentBreakdown; track dept.departmentName) {
              <mat-card class="department-card">
                <h3>{{ dept.departmentName }}</h3>
                <div class="dept-stats">
                  <span class="stat present">
                    <mat-icon>check</mat-icon>
                    {{ dept.presentCount }}/{{ dept.totalEmployees }}
                  </span>
                  @if (dept.lateCount > 0) {
                    <span class="stat late">
                      <mat-icon>schedule</mat-icon>
                      {{ dept.lateCount }} late
                    </span>
                  }
                </div>
              </mat-card>
            }
          </div>
        </div>
      }

      <!-- Employee Grid -->
      <div class="employee-section">
        <div class="section-header">
          <h2>
            <mat-icon>badge</mat-icon>
            Live Employee Status
          </h2>
          <mat-form-field class="search-field" appearance="outline">
            <mat-label>Search Employees</mat-label>
            <input matInput
                   [(ngModel)]="searchQuery"
                   (ngModelChange)="filterEmployees()"
                   placeholder="Search by name, code, or position...">
            <mat-icon matPrefix>search</mat-icon>
            @if (searchQuery) {
              <button matSuffix mat-icon-button (click)="clearSearch()">
                <mat-icon>close</mat-icon>
              </button>
            }
          </mat-form-field>
        </div>

        @if (loading) {
          <div class="loading-spinner">
            <mat-spinner></mat-spinner>
          </div>
        } @else {
          <div class="employee-grid">
            @for (employee of filteredEmployees; track employee.employeeId) {
              <mat-card class="employee-card" [class.present]="employee.status === 'Present'"
                        [class.absent]="employee.status === 'Absent'"
                        [class.late]="employee.isLate">
                <div class="card-content">
                  <div class="employee-photo">
                    @if (employee.photoBase64) {
                      <img [src]="'data:image/jpeg;base64,' + employee.photoBase64" [alt]="employee.fullName">
                    } @else {
                      <div class="photo-placeholder">
                        <mat-icon>person</mat-icon>
                      </div>
                    }
                    <div class="status-indicator" [class]="employee.status.toLowerCase()">
                      <mat-icon>{{ getStatusIcon(employee.status) }}</mat-icon>
                    </div>
                  </div>

                  <div class="employee-info">
                    <div class="name-section">
                      <h3>{{ employee.fullName }}</h3>
                      @if (employee.isLate) {
                        <mat-icon class="late-badge" matTooltip="Late by {{ employee.lateMinutes }} min">schedule</mat-icon>
                      }
                    </div>
                    <p class="employee-role">{{ employee.position || 'N/A' }}</p>

                    <div class="time-info">
                      @if (employee.timeIn) {
                        <div class="time-row" [class.ontime]="!employee.isLate" [class.late]="employee.isLate">
                          <mat-icon>login</mat-icon>
                          <span>{{ formatTime(employee.timeIn) }}</span>
                        </div>
                      } @else {
                        <div class="time-row absent">
                          <mat-icon>cancel</mat-icon>
                          <span>Absent</span>
                        </div>
                      }
                      @if (employee.timeOut) {
                        <div class="time-row">
                          <mat-icon>logout</mat-icon>
                          <span>{{ formatTime(employee.timeOut) }}</span>
                        </div>
                      }
                    </div>

                    <div class="weekly-attendance">
                      <div class="weekly-title">Week Overview</div>
                      <div class="week-circles">
                        <div class="day-circle {{ getWeekDay(employee.employeeId, 'monday').status }}"
                             [title]="getDayTooltip(employee.employeeId, 'Monday', 'monday')"
                             data-day="M">M</div>
                        <div class="day-circle {{ getWeekDay(employee.employeeId, 'tuesday').status }}"
                             [title]="getDayTooltip(employee.employeeId, 'Tuesday', 'tuesday')"
                             data-day="T">T</div>
                        <div class="day-circle {{ getWeekDay(employee.employeeId, 'wednesday').status }}"
                             [title]="getDayTooltip(employee.employeeId, 'Wednesday', 'wednesday')"
                             data-day="W">W</div>
                        <div class="day-circle {{ getWeekDay(employee.employeeId, 'thursday').status }}"
                             [title]="getDayTooltip(employee.employeeId, 'Thursday', 'thursday')"
                             data-day="T">T</div>
                        <div class="day-circle {{ getWeekDay(employee.employeeId, 'friday').status }}"
                             [title]="getDayTooltip(employee.employeeId, 'Friday', 'friday')"
                             data-day="F">F</div>
                      </div>
                    </div>
                  </div>
                </div>
              </mat-card>
            } @empty {
              <div class="empty-state">
                <mat-icon>people_outline</mat-icon>
                <h3>No employees found</h3>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .attendance-container {
      padding: 24px;
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
    }

    .header-section {
      margin-bottom: 32px;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .export-btn {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      font-weight: 600;
    }

    .export-btn mat-icon {
      margin-right: 8px;
    }

    h1 {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      margin: 0;
      font-size: 32px;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    h1 mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .refresh-info {
      display: flex;
      align-items: center;
      gap: 8px;
      color: white;
      background: rgba(255, 255, 255, 0.1);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
    }

    .refresh-info mat-icon {
      font-size: 20px;
      animation: rotate 2s linear infinite;
    }

    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    .metric-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px !important;
      border-radius: 12px !important;
      transition: transform 0.2s;
    }

    .metric-card:hover {
      transform: translateY(-4px);
    }

    .metric-card mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    .metric-card.total {
      background: linear-gradient(135deg, #4169e1, #1e90ff);
      color: white;
    }

    .metric-card.present {
      background: linear-gradient(135deg, #28a745, #20c997);
      color: white;
    }

    .metric-card.absent {
      background: linear-gradient(135deg, #dc3545, #e74c3c);
      color: white;
    }

    .metric-card.late {
      background: linear-gradient(135deg, #ffc107, #ff9800);
      color: white;
    }

    .metric-content h2 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
    }

    .metric-content p {
      margin: 4px 0 0;
      font-size: 14px;
      opacity: 0.9;
    }

    .department-section, .employee-section {
      margin-bottom: 32px;
    }

    .department-section h2, .employee-section h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      margin-bottom: 16px;
      font-size: 24px;
      font-weight: 600;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      gap: 20px;
    }

    .section-header h2 {
      margin: 0;
    }

    .search-field {
      min-width: 300px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 8px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .search-field ::ng-deep .mat-mdc-form-field-focus-overlay {
      background-color: transparent;
    }

    .search-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: transparent;
    }

    .search-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .department-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
    }

    .department-card {
      padding: 16px !important;
      border-radius: 8px !important;
    }

    .department-card h3 {
      margin: 0 0 12px;
      color: #00008B;
      font-size: 18px;
    }

    .dept-stats {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .dept-stats .stat {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 14px;
    }

    .dept-stats .stat.present {
      color: #28a745;
    }

    .dept-stats .stat.late {
      color: #ff9800;
    }

    .dept-stats mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .employee-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 12px;
    }

    @media (max-width: 1800px) {
      .employee-grid {
        grid-template-columns: repeat(6, 1fr);
      }
    }

    @media (max-width: 1400px) {
      .employee-grid {
        grid-template-columns: repeat(5, 1fr);
      }
    }

    @media (max-width: 1200px) {
      .employee-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    @media (max-width: 900px) {
      .employee-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 600px) {
      .employee-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .employee-card {
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1));
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 24px !important;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37) !important;
      position: relative;
      min-height: 200px;
    }

    .employee-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #1e3c72 0%, #2a5298 100%);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.3s ease;
    }

    .employee-card.present::before {
      background: linear-gradient(90deg, rgba(52, 211, 153, 1), rgba(16, 185, 129, 1));
    }

    .employee-card.absent::before {
      background: linear-gradient(90deg, rgba(248, 113, 113, 1), rgba(239, 68, 68, 1));
    }

    .employee-card.late::before {
      background: linear-gradient(90deg, rgba(251, 191, 36, 1), rgba(245, 158, 11, 1));
    }

    .employee-card:hover::before {
      transform: scaleX(1);
    }

    .employee-card:hover {
      transform: translateY(-6px) scale(1.02);
      box-shadow: 0 16px 48px rgba(31, 38, 135, 0.5) !important;
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.15));
    }

    .card-content {
      display: flex;
      flex-direction: column;
      padding: 0;
    }

    .employee-photo {
      position: relative;
      width: 100%;
      height: 140px;
      background: linear-gradient(135deg, rgba(248, 249, 250, 0.5), rgba(233, 236, 239, 0.5));
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .employee-photo img {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid rgba(255, 255, 255, 0.8);
      box-shadow: 0 8px 24px rgba(31, 38, 135, 0.3);
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .employee-photo img:hover {
      transform: scale(1.05);
      box-shadow: 0 12px 32px rgba(31, 38, 135, 0.5);
      border-color: rgba(30, 60, 114, 0.8);
    }

    .photo-placeholder {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(233, 236, 239, 0.8), rgba(248, 249, 250, 0.8));
      border: 3px solid rgba(255, 255, 255, 0.8);
      box-shadow: 0 8px 24px rgba(31, 38, 135, 0.3);
    }

    .photo-placeholder mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #adb5bd;
    }

    .status-indicator {
      position: absolute;
      bottom: 12px;
      right: 12px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 2px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 4px 12px rgba(31, 38, 135, 0.3);
      transition: all 0.3s ease;
    }

    .employee-card:hover .status-indicator {
      transform: scale(1.15);
      box-shadow: 0 6px 16px rgba(31, 38, 135, 0.5);
    }

    .status-indicator.present {
      background: linear-gradient(135deg, rgba(52, 211, 153, 0.8), rgba(16, 185, 129, 0.8));
      color: white;
    }

    .status-indicator.absent {
      background: linear-gradient(135deg, rgba(248, 113, 113, 0.8), rgba(239, 68, 68, 0.8));
      color: white;
    }

    .status-indicator.late {
      background: linear-gradient(135deg, rgba(251, 191, 36, 0.8), rgba(245, 158, 11, 0.8));
      color: white;
    }

    .status-indicator mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .employee-info {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .name-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .name-section h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      background: linear-gradient(135deg, #1e3c72, #2a5298);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .late-badge {
      font-size: 18px !important;
      width: 18px !important;
      height: 18px !important;
      color: #ff9800;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .employee-code {
      margin: 0;
      font-size: 0.75rem;
      color: rgba(30, 60, 114, 0.7);
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .employee-role {
      margin: 0;
      font-size: 0.85rem;
      color: rgba(30, 60, 114, 0.8);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .time-info {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.3);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .time-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }

    .time-row mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .time-row.ontime {
      background: linear-gradient(135deg, rgba(52, 211, 153, 0.8), rgba(16, 185, 129, 0.8));
      color: white;
    }

    .time-row.late {
      background: linear-gradient(135deg, rgba(251, 191, 36, 0.8), rgba(245, 158, 11, 0.8));
      color: white;
    }

    .time-row.absent {
      background: linear-gradient(135deg, rgba(248, 113, 113, 0.8), rgba(239, 68, 68, 0.8));
      color: white;
    }

    .weekly-attendance {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
    }

    .weekly-title {
      font-size: 0.7rem;
      color: rgba(30, 60, 114, 0.8);
      margin-bottom: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: center;
    }

    .week-circles {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .day-circle {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      font-weight: bold;
      color: white;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
      position: relative;
      cursor: pointer;
    }

    .day-circle:hover {
      transform: scale(1.2);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 10;
    }

    .day-circle.ontime {
      background: linear-gradient(45deg, #28a745, #20c997);
    }

    .day-circle.late {
      background: linear-gradient(45deg, #ffc107, #fd7e14);
    }

    .day-circle.absent {
      background: linear-gradient(45deg, #dc3545, #e63946);
    }

    .day-circle:hover::after {
      content: attr(title);
      position: absolute;
      bottom: 120%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.75rem;
      white-space: nowrap;
      z-index: 1000;
      font-weight: normal;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      animation: tooltipFadeIn 0.2s ease;
      pointer-events: none;
      text-shadow: none;
    }

    @keyframes tooltipFadeIn {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      padding: 40px;
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
export class PeopleComponent implements OnInit, OnDestroy {
  employees: Employee[] = [];
  filteredEmployees: Employee[] = [];
  metrics: AttendanceMetrics | null = null;
  weeklyAttendance: Map<string, any> = new Map();
  loading = false;
  lastUpdate = new Date();
  currentUser: any;
  searchQuery: string = '';
  private autoRefreshSubscription?: Subscription;
  private signalRSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private attendanceService: AttendanceService,
    private router: Router,
    private dialog: MatDialog
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    console.log('🌍 People Component - Environment Check');
    console.log('   API URL:', environment.apiUrl);
    console.log('   Production:', environment.production);

    this.loadData();

    // Auto-refresh every 10 minutes
    this.autoRefreshSubscription = interval(600000)
      .pipe(switchMap(() => this.loadDataObservable()))
      .subscribe();

    // Listen to SignalR updates
    this.signalRSubscription = this.attendanceService.refresh$
      .subscribe(() => {
        this.loadData();
      });
  }

  ngOnDestroy(): void {
    this.autoRefreshSubscription?.unsubscribe();
    this.signalRSubscription?.unsubscribe();
  }

  loadData(): void {
    this.loading = true;

    // Load all data in parallel using forkJoin for better performance
    const employees$ = this.attendanceService.getEmployees();
    const metrics$ = this.attendanceService.getMetrics();
    const weekly$ = this.attendanceService.getWeeklyAttendance();

    // Combine all observables
    employees$.subscribe({
      next: (data) => {
        // Sort employees: Present first (sorted by earliest timeIn), then Absent
        this.employees = data.sort((a, b) => {
          // Present employees come before Absent
          if (a.status === 'Present' && b.status !== 'Present') return -1;
          if (a.status !== 'Present' && b.status === 'Present') return 1;

          // If both are Present, sort by timeIn (earliest first)
          if (a.status === 'Present' && b.status === 'Present') {
            if (a.timeIn && b.timeIn) {
              return a.timeIn.localeCompare(b.timeIn);
            }
            // If one has timeIn and other doesn't, prioritize the one with timeIn
            if (a.timeIn && !b.timeIn) return -1;
            if (!a.timeIn && b.timeIn) return 1;
          }

          // If both are Absent, maintain original order
          return 0;
        });

        // Initialize filtered employees
        this.filterEmployees();

        this.loading = false;
        this.lastUpdate = new Date();
      },
      error: (err) => {
        console.error('Error loading employees:', err);
        this.loading = false;
      }
    });

    metrics$.subscribe({
      next: (data) => {
        this.metrics = data;
      },
      error: (err) => {
        console.error('Error loading metrics:', err);
      }
    });

    weekly$.subscribe({
      next: (data) => {
        // Convert array to Map for quick lookup
        data.forEach((item: any) => {
          this.weeklyAttendance.set(item.employeeId, item.weeklyAttendance);
        });
      },
      error: (err) => {
        console.error('Error loading weekly attendance:', err);
      }
    });
  }

  private loadDataObservable() {
    this.loadData();
    return of(undefined);
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Present':
        return 'check_circle';
      case 'Absent':
        return 'cancel';
      case 'Late':
        return 'schedule';
      case 'OnLeave':
        return 'event_busy';
      default:
        return 'help_outline';
    }
  }

  formatTime(timeString: string | null): string {
    if (!timeString) return 'N/A';

    // Time is in format "HH:mm:ss" from SQL Server
    const parts = timeString.split(':');
    if (parts.length < 2) return timeString;

    const hours = parseInt(parts[0]);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    return `${displayHours}:${minutes} ${ampm}`;
  }

  getWeekDay(employeeId: string, day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'): any {
    const weekData = this.weeklyAttendance.get(employeeId);
    return weekData ? weekData[day] : { status: 'absent' };
  }

  getDayTooltip(employeeId: string, dayName: string, day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'): string {
    const dayData = this.getWeekDay(employeeId, day);

    if (dayData.status === 'absent') {
      return `${dayName}: Absent`;
    } else if (dayData.status === 'late') {
      const timeInFormatted = dayData.timeIn ? this.formatTime(dayData.timeIn + ':00') : 'N/A';
      return `${dayName}: ${timeInFormatted}`;
    } else {
      const timeInFormatted = dayData.timeIn ? this.formatTime(dayData.timeIn + ':00') : 'N/A';
      return `${dayName}: ${timeInFormatted}`;
    }
  }

  downloadWeeklyReport(): void {
    const dialogRef = this.dialog.open(WeeklyReportDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const url = `${environment.apiUrl}/reports/weekly?weekOffset=${result.weekOffset}`;
        window.open(url, '_blank');
      }
    });
  }

  downloadMonthlyReport(): void {
    const dialogRef = this.dialog.open(MonthlyReportDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const url = `${environment.apiUrl}/reports/monthly?month=${result.month}&year=${result.year}`;
        window.open(url, '_blank');
      }
    });
  }

  filterEmployees(): void {
    if (!this.searchQuery || this.searchQuery.trim() === '') {
      this.filteredEmployees = [...this.employees];
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    this.filteredEmployees = this.employees.filter(employee => {
      const fullName = employee.fullName?.toLowerCase() || '';
      const employeeCode = employee.employeeCode?.toLowerCase() || '';
      const position = employee.position?.toLowerCase() || '';

      return fullName.includes(query) ||
             employeeCode.includes(query) ||
             position.includes(query);
    });
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filterEmployees();
  }

  logout(): void {
    this.attendanceService.stopConnection();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

// Weekly Report Dialog Component
@Component({
  selector: 'weekly-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>calendar_today</mat-icon>
      Select Week for Report
    </h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" style="width: 100%;">
        <mat-label>Select Week</mat-label>
        <mat-select [(ngModel)]="selectedWeekOffset">
          @for (week of weekOptions; track week.value) {
            <mat-option [value]="week.value">{{ week.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onDownload()">
        <mat-icon>download</mat-icon>
        Download
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #00008B;
    }

    mat-dialog-content {
      padding: 20px 24px;
      min-height: 120px;
    }

    mat-dialog-actions {
      padding: 16px 24px;
    }

    mat-dialog-actions button {
      margin-left: 8px;
    }
  `]
})
export class WeeklyReportDialogComponent {
  selectedWeekOffset: number = 0;
  weekOptions: { value: number; label: string }[] = [];

  constructor(
    public dialogRef: MatDialogRef<WeeklyReportDialogComponent>
  ) {
    this.generateWeekOptions();
  }

  generateWeekOptions(): void {
    const options = [];
    const today = new Date();

    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) - (i * 7));

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 4);

      const label = i === 0
        ? `Current Week (${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)})`
        : `${i} week${i > 1 ? 's' : ''} ago (${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)})`;

      options.push({ value: i, label });
    }

    this.weekOptions = options;
  }

  formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onDownload(): void {
    this.dialogRef.close({ weekOffset: this.selectedWeekOffset });
  }
}

// Monthly Report Dialog Component
@Component({
  selector: 'monthly-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>date_range</mat-icon>
      Select Month for Report
    </h2>
    <mat-dialog-content>
      <div style="display: flex; gap: 12px;">
        <mat-form-field appearance="outline" style="flex: 1;">
          <mat-label>Month</mat-label>
          <mat-select [(ngModel)]="selectedMonth">
            @for (month of months; track month.value) {
              <mat-option [value]="month.value">{{ month.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" style="flex: 1;">
          <mat-label>Year</mat-label>
          <mat-select [(ngModel)]="selectedYear">
            @for (year of years; track year) {
              <mat-option [value]="year">{{ year }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onDownload()">
        <mat-icon>download</mat-icon>
        Download
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #00008B;
    }

    mat-dialog-content {
      padding: 20px 24px;
      min-height: 120px;
    }

    mat-dialog-actions {
      padding: 16px 24px;
    }

    mat-dialog-actions button {
      margin-left: 8px;
    }
  `]
})
export class MonthlyReportDialogComponent {
  selectedMonth: number;
  selectedYear: number;

  months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  years: number[] = [];

  constructor(
    public dialogRef: MatDialogRef<MonthlyReportDialogComponent>
  ) {
    const currentDate = new Date();
    this.selectedMonth = currentDate.getMonth() + 1;
    this.selectedYear = currentDate.getFullYear();

    // Generate last 3 years
    const currentYear = currentDate.getFullYear();
    for (let i = 0; i < 3; i++) {
      this.years.push(currentYear - i);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onDownload(): void {
    this.dialogRef.close({
      month: this.selectedMonth,
      year: this.selectedYear
    });
  }
}
