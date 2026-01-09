import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth.service';
import { AttendanceService } from '../../services/attendance.service';
import { Employee, AttendanceMetrics } from '../../models/attendance.model';
import { interval, Subscription, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { NavbarComponent } from '../shared/navbar/navbar.component';

// Hardcoded development environment for debugging
const environment = {
  production: false,
  apiUrl: '/api',
  signalRUrl: ''
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
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatMenuModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="attendance-container">
      @if (!trainingAccess && !mainOfficeAccess && !condomFactoryAccess && !sanitaryPadsAccess && !newRoadAccess && !captownAccess && !brionkhorspruitAccess && !portElizabethAccess && !logisticsAccess) {
        <!-- Training Section - Separated -->
        <div class="training-section-header">
          <h2>
            <mat-icon>school</mat-icon>
            Employee Training & Development
          </h2>
          <p>Access training materials, videos, and resources for all employees</p>
        </div>

        <div class="training-access-section">
          <mat-card class="training-access-card">
            <div class="training-card-content">
              <mat-icon class="training-main-icon">school</mat-icon>
              <h2>Training Center</h2>
              <p>Watch training videos, download manuals, and access learning resources for sales, production, safety, and company policies</p>
              <button mat-raised-button color="primary" (click)="openTrainingDialog()" class="training-access-btn">
                <mat-icon>lock_open</mat-icon>
                Access Training Center
              </button>
            </div>
          </mat-card>
        </div>

        <!-- Departments & Branches Section -->
        <div class="departments-section-header">
          <h2>
            <mat-icon>business</mat-icon>
            Departments & Branch Locations
          </h2>
          <p>Select a department or branch location to access specific operational data</p>
        </div>

        <div class="access-section">
          <mat-card class="access-card">
            <mat-icon class="folder-icon">folder_special</mat-icon>
            <h2>Main Office</h2>
            <p>Access employee attendance records and HR data</p>
            <button mat-raised-button color="primary" (click)="openMainOfficeDialog()" class="access-btn">
              <mat-icon>lock_open</mat-icon>
              Access Main Office
            </button>
          </mat-card>

          <mat-card class="access-card">
            <mat-icon class="folder-icon">factory</mat-icon>
            <h2>Condom Factory</h2>
            <p>Access factory operations and production data</p>
            <button mat-raised-button color="primary" (click)="openCondomFactoryDialog()" class="access-btn">
              <mat-icon>lock_open</mat-icon>
              Access Condom Factory
            </button>
          </mat-card>

          <mat-card class="access-card">
            <mat-icon class="folder-icon">local_hospital</mat-icon>
            <h2>Sanitary Pads</h2>
            <p>Access sanitary pads production and inventory</p>
            <button mat-raised-button color="primary" (click)="openSanitaryPadsDialog()" class="access-btn">
              <mat-icon>lock_open</mat-icon>
              Access Sanitary Pads
            </button>
          </mat-card>

          <mat-card class="access-card">
            <mat-icon class="folder-icon">location_on</mat-icon>
            <h2>New Road</h2>
            <p>Access New Road branch operations and data</p>
            <button mat-raised-button color="primary" (click)="openNewRoadDialog()" class="access-btn">
              <mat-icon>lock_open</mat-icon>
              Access New Road
            </button>
          </mat-card>

          <mat-card class="access-card">
            <mat-icon class="folder-icon">location_city</mat-icon>
            <h2>Cape Town</h2>
            <p>Access Cape Town branch operations and data</p>
            <button mat-raised-button color="primary" (click)="openCaptownDialog()" class="access-btn">
              <mat-icon>lock_open</mat-icon>
              Access Cape Town
            </button>
          </mat-card>

          <mat-card class="access-card">
            <mat-icon class="folder-icon">place</mat-icon>
            <h2>Brionkhorspruit</h2>
            <p>Access Brionkhorspruit branch operations and data</p>
            <button mat-raised-button color="primary" (click)="openBrionkhorspruitDialog()" class="access-btn">
              <mat-icon>lock_open</mat-icon>
              Access Brionkhorspruit
            </button>
          </mat-card>

          <mat-card class="access-card">
            <mat-icon class="folder-icon">apartment</mat-icon>
            <h2>Port Elizabeth</h2>
            <p>Access Port Elizabeth branch operations and data</p>
            <button mat-raised-button color="primary" (click)="openPortElizabethDialog()" class="access-btn">
              <mat-icon>lock_open</mat-icon>
              Access Port Elizabeth
            </button>
          </mat-card>

          <mat-card class="access-card">
            <mat-icon class="folder-icon">local_shipping</mat-icon>
            <h2>Logistics</h2>
            <p>Access logistics operations and supply chain data</p>
            <button mat-raised-button color="primary" (click)="openLogisticsDialog()" class="access-btn">
              <mat-icon>lock_open</mat-icon>
              Access Logistics
            </button>
          </mat-card>
        </div>
      } @else if (trainingAccess) {
        <!-- Training Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>school</mat-icon>
              Employee Training Center
            </h1>
            <p class="subtitle">Training videos, manuals, and resources for new employees</p>
          </div>

          <div class="training-content">
            <div class="training-categories">
              <mat-card class="training-category-card">
                <mat-icon class="category-icon">people</mat-icon>
                <h3>Sales Representative Training</h3>
                <p>Complete training materials for sales team members</p>
                <div class="training-actions">
                  <button mat-raised-button color="primary">
                    <mat-icon>play_circle</mat-icon>
                    Watch Videos
                  </button>
                  <button mat-raised-button>
                    <mat-icon>picture_as_pdf</mat-icon>
                    View Manuals
                  </button>
                </div>
              </mat-card>

              <mat-card class="training-category-card">
                <mat-icon class="category-icon">handshake</mat-icon>
                <h3>Customer Service Training</h3>
                <p>Essential skills and protocols for customer interactions</p>
                <div class="training-actions">
                  <button mat-raised-button color="primary">
                    <mat-icon>play_circle</mat-icon>
                    Watch Videos
                  </button>
                  <button mat-raised-button>
                    <mat-icon>picture_as_pdf</mat-icon>
                    View Manuals
                  </button>
                </div>
              </mat-card>

              <mat-card class="training-category-card">
                <mat-icon class="category-icon">production_quantity_limits</mat-icon>
                <h3>Production Training</h3>
                <p>Manufacturing processes and quality control standards</p>
                <div class="training-actions">
                  <button mat-raised-button color="primary">
                    <mat-icon>play_circle</mat-icon>
                    Watch Videos
                  </button>
                  <button mat-raised-button>
                    <mat-icon>picture_as_pdf</mat-icon>
                    View Manuals
                  </button>
                </div>
              </mat-card>

              <mat-card class="training-category-card">
                <mat-icon class="category-icon">health_and_safety</mat-icon>
                <h3>Safety & Compliance</h3>
                <p>Workplace safety procedures and regulatory compliance</p>
                <div class="training-actions">
                  <button mat-raised-button color="primary">
                    <mat-icon>play_circle</mat-icon>
                    Watch Videos
                  </button>
                  <button mat-raised-button>
                    <mat-icon>picture_as_pdf</mat-icon>
                    View Manuals
                  </button>
                </div>
              </mat-card>

              <mat-card class="training-category-card">
                <mat-icon class="category-icon">admin_panel_settings</mat-icon>
                <h3>Company Policies</h3>
                <p>HR policies, code of conduct, and employee handbook</p>
                <div class="training-actions">
                  <button mat-raised-button color="primary">
                    <mat-icon>play_circle</mat-icon>
                    Watch Videos
                  </button>
                  <button mat-raised-button>
                    <mat-icon>picture_as_pdf</mat-icon>
                    View Manuals
                  </button>
                </div>
              </mat-card>

              <mat-card class="training-category-card">
                <mat-icon class="category-icon">computer</mat-icon>
                <h3>IT Systems Training</h3>
                <p>Software applications and internal systems usage</p>
                <div class="training-actions">
                  <button mat-raised-button color="primary">
                    <mat-icon>play_circle</mat-icon>
                    Watch Videos
                  </button>
                  <button mat-raised-button>
                    <mat-icon>picture_as_pdf</mat-icon>
                    View Manuals
                  </button>
                </div>
              </mat-card>
            </div>
          </div>
        </div>
      } @else if (mainOfficeAccess) {
        <!-- Original Attendance Content -->
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
      } @else if (condomFactoryAccess) {
        <!-- Condom Factory Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>factory</mat-icon>
              Condom Factory Operations
            </h1>
            <p class="subtitle">Production monitoring and quality control</p>
          </div>

          <div class="coming-soon">
            <mat-icon>construction</mat-icon>
            <h2>Factory Dashboard Coming Soon</h2>
            <p>Production tracking, quality metrics, and operations management will be available here.</p>
          </div>
        </div>
      } @else if (sanitaryPadsAccess) {
        <!-- Sanitary Pads Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>local_hospital</mat-icon>
              Sanitary Pads Production
            </h1>
            <p class="subtitle">Manufacturing and inventory management</p>
          </div>

          <div class="coming-soon">
            <mat-icon>construction</mat-icon>
            <h2>Production Dashboard Coming Soon</h2>
            <p>Sanitary pads production tracking, inventory levels, and quality assurance will be available here.</p>
          </div>
        </div>
      } @else if (newRoadAccess) {
        <!-- New Road Branch Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>location_on</mat-icon>
              New Road Branch
            </h1>
            <p class="subtitle">Branch operations and staff management</p>
          </div>

          <div class="coming-soon">
            <mat-icon>construction</mat-icon>
            <h2>Branch Dashboard Coming Soon</h2>
            <p>Staff attendance, performance metrics, and operations management will be available here.</p>
          </div>
        </div>
      } @else if (captownAccess) {
        <!-- Captown Branch Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>location_city</mat-icon>
              Captown Branch
            </h1>
            <p class="subtitle">Branch operations and staff management</p>
          </div>

          <div class="coming-soon">
            <mat-icon>construction</mat-icon>
            <h2>Branch Dashboard Coming Soon</h2>
            <p>Staff attendance, performance metrics, and operations management will be available here.</p>
          </div>
        </div>
      } @else if (brionkhorspruitAccess) {
        <!-- Brionkhorspruit Branch Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>place</mat-icon>
              Brionkhorspruit Branch
            </h1>
            <p class="subtitle">Branch operations and staff management</p>
          </div>

          <div class="coming-soon">
            <mat-icon>construction</mat-icon>
            <h2>Branch Dashboard Coming Soon</h2>
            <p>Staff attendance, performance metrics, and operations management will be available here.</p>
          </div>
        </div>
      } @else if (portElizabethAccess) {
        <!-- Port Elizabeth Branch Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>apartment</mat-icon>
              Port Elizabeth Branch
            </h1>
            <p class="subtitle">Branch operations and staff management</p>
          </div>

          <div class="coming-soon">
            <mat-icon>construction</mat-icon>
            <h2>Branch Dashboard Coming Soon</h2>
            <p>Staff attendance, performance metrics, and operations management will be available here.</p>
          </div>
        </div>
      } @else if (logisticsAccess) {
        <!-- Logistics Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>local_shipping</mat-icon>
              Logistics Operations
            </h1>
            <p class="subtitle">Supply chain and logistics management</p>
          </div>

          <div class="coming-soon">
            <mat-icon>construction</mat-icon>
            <h2>Logistics Dashboard Coming Soon</h2>
            <p>Transportation tracking, inventory management, and supply chain analytics will be available here.</p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .attendance-container {
      padding: 80px;
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
    }

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

    .notification-header button {
      font-size: 13px;
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
      color: #999;
    }

    .no-notifications mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }

    .no-notifications p {
      margin: 0;
      font-size: 16px;
    }

    .notification-item {
      display: flex;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid #f0f0f0;
      transition: background 0.2s;
      cursor: pointer;
    }

    .notification-item:hover {
      background: #f9f9f9;
    }

    .notification-item.unread {
      background: #e3f2fd;
    }

    .notification-item.unread:hover {
      background: #d1e7f9;
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
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin: 0 0 4px 0;
    }

    .notification-message {
      font-size: 13px;
      color: #666;
      margin: 0 0 6px 0;
      line-height: 1.4;
    }

    .notification-time {
      font-size: 12px;
      color: #999;
    }

    .notification-item button {
      flex-shrink: 0;
      color: #4CAF50;
    }

    .notification-footer {
      padding: 12px 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      background: #f5f5f5;
    }

    .notification-footer button {
      width: 100%;
    }

    .training-section-header,
    .departments-section-header {
      text-align: center;
      margin: 40px 0 32px 0;
      padding: 0 24px;
    }

    .training-section-header h2,
    .departments-section-header h2 {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      font-size: 32px;
      font-weight: 600;
      color: white;
      margin: 0 0 12px 0;
    }

    .training-section-header h2 mat-icon,
    .departments-section-header h2 mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: white;
    }

    .training-section-header p,
    .departments-section-header p {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.9);
      margin: 0;
    }

    .training-access-section {
      display: flex;
      justify-content: center;
      padding: 0 24px 60px 24px;
      margin-bottom: 40px;
      border-bottom: 2px solid rgba(0, 0, 139, 0.1);
    }

    .training-access-card {
      max-width: 800px;
      width: 100%;
      background: linear-gradient(135deg, rgba(0, 0, 139, 0.95) 0%, rgba(30, 144, 255, 0.95) 100%) !important;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 24px !important;
      box-shadow: 0 12px 48px rgba(0, 0, 139, 0.4) !important;
      padding: 0 !important;
      overflow: hidden;
    }

    .training-card-content {
      padding: 64px 48px;
      text-align: center;
      color: white;
    }

    .training-main-icon {
      font-size: 96px;
      width: 96px;
      height: 96px;
      color: white;
      margin-bottom: 24px;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
    }

    .training-card-content h2 {
      font-size: 42px;
      font-weight: 700;
      color: white;
      margin: 0 0 20px 0;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .training-card-content p {
      font-size: 18px;
      color: rgba(255, 255, 255, 0.95);
      margin: 0 0 40px 0;
      line-height: 1.6;
    }

    .training-access-btn {
      padding: 16px 48px !important;
      font-size: 18px !important;
      background: white !important;
      color: #00008B !important;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3) !important;
      transition: all 0.3s ease !important;
      font-weight: 600 !important;
    }

    .training-access-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4) !important;
      background: rgba(255, 255, 255, 0.95) !important;
    }

    .training-access-btn mat-icon {
      margin-right: 8px;
    }

    .access-section {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 32px;
      padding-bottom: 40px;
      flex-wrap: wrap;
    }

    .access-card {
      text-align: center;
      padding: 48px !important;
      max-width: 400px;
      min-width: 350px;
      background: rgba(255, 255, 255, 0.95) !important;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 16px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
    }

    .access-card .folder-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: #00008B;
      margin: 0 auto 24px auto;
      display: block;
    }

    .access-card h2 {
      font-size: 32px;
      font-weight: 600;
      color: #00008B;
      margin: 0 0 16px 0;
    }

    .access-card p {
      font-size: 16px;
      color: #666;
      margin: 0 0 32px 0;
    }

    .access-btn {
      padding: 12px 32px !important;
      font-size: 16px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 139, 0.3) !important;
      transition: all 0.3s ease !important;
    }

    .access-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 139, 0.4) !important;
    }

    .access-btn mat-icon {
      margin-right: 8px;
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

    .factory-section {
      max-width: 1400px;
      margin: 0 auto;
    }

    .factory-section .header-section {
      text-align: center;
      margin-bottom: 48px;
    }

    .factory-section h1 {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: white;
      margin: 0 0 12px 0;
      font-size: 36px;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .factory-section h1 mat-icon {
      font-size: 42px;
      width: 42px;
      height: 42px;
    }

    .factory-section .subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      margin: 0;
    }

    .coming-soon {
      text-align: center;
      padding: 80px 40px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      max-width: 600px;
      margin: 0 auto;
    }

    .coming-soon mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: #00008B;
      margin-bottom: 24px;
    }

    .coming-soon h2 {
      color: #00008B;
      font-size: 28px;
      font-weight: 600;
      margin: 0 0 16px 0;
    }

    .coming-soon p {
      color: #666;
      font-size: 16px;
      line-height: 1.6;
      margin: 0;
    }

    .training-content {
      padding: 24px 0;
    }

    .training-categories {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 24px;
      margin-top: 24px;
    }

    .training-category-card {
      padding: 32px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .training-category-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }

    .category-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #00008B;
      margin-bottom: 16px;
    }

    .training-category-card h3 {
      color: #00008B;
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 12px 0;
    }

    .training-category-card p {
      color: #666;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 20px 0;
    }

    .training-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .training-actions button {
      flex: 1;
      min-width: 140px;
    }

    .training-actions button mat-icon {
      margin-right: 8px;
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
  notificationCount: number = 3;
  showNotifications: boolean = false;
  notifications: any[] = [
    {
      id: 1,
      icon: 'person_add',
      iconColor: '#4CAF50',
      title: 'New Employee Added',
      message: 'John Doe has been added to the Main Office department',
      time: '5 minutes ago',
      read: false
    },
    {
      id: 2,
      icon: 'assignment_late',
      iconColor: '#FF9800',
      title: 'Attendance Alert',
      message: '3 employees marked as late today',
      time: '1 hour ago',
      read: false
    },
    {
      id: 3,
      icon: 'local_shipping',
      iconColor: '#2196F3',
      title: 'Logistics Update',
      message: 'New shipment scheduled for delivery',
      time: '2 hours ago',
      read: false
    },
    {
      id: 4,
      icon: 'factory',
      iconColor: '#9C27B0',
      title: 'Production Report',
      message: 'Condom Factory monthly report is ready',
      time: '3 hours ago',
      read: false
    },
    {
      id: 5,
      icon: 'school',
      iconColor: '#00BCD4',
      title: 'Training Reminder',
      message: 'New training video available for Sales Representatives',
      time: '5 hours ago',
      read: false
    }
  ];
  trainingAccess: boolean = false;
  mainOfficeAccess: boolean = false;
  condomFactoryAccess: boolean = false;
  sanitaryPadsAccess: boolean = false;
  newRoadAccess: boolean = false;
  captownAccess: boolean = false;
  brionkhorspruitAccess: boolean = false;
  portElizabethAccess: boolean = false;
  logisticsAccess: boolean = false;
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

    // Close notifications dropdown when clicking outside
    document.addEventListener('click', () => {
      this.showNotifications = false;
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

  openTrainingDialog(): void {
    const dialogRef = this.dialog.open(TrainingPasswordDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.trainingAccess = true;
      }
    });
  }

  openMainOfficeDialog(): void {
    const dialogRef = this.dialog.open(MainOfficePasswordDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.mainOfficeAccess = true;
        this.loadData(); // Load data once access is granted
      }
    });
  }

  openCondomFactoryDialog(): void {
    const dialogRef = this.dialog.open(CondomFactoryPasswordDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.condomFactoryAccess = true;
      }
    });
  }

  openSanitaryPadsDialog(): void {
    const dialogRef = this.dialog.open(SanitaryPadsPasswordDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.sanitaryPadsAccess = true;
      }
    });
  }

  openNewRoadDialog(): void {
    const dialogRef = this.dialog.open(NewRoadPasswordDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.newRoadAccess = true;
      }
    });
  }

  openCaptownDialog(): void {
    const dialogRef = this.dialog.open(CaptownPasswordDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.captownAccess = true;
      }
    });
  }

  openBrionkhorspruitDialog(): void {
    const dialogRef = this.dialog.open(BrionkhorspruitPasswordDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.brionkhorspruitAccess = true;
      }
    });
  }

  openPortElizabethDialog(): void {
    const dialogRef = this.dialog.open(PortElizabethPasswordDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.portElizabethAccess = true;
      }
    });
  }

  openLogisticsDialog(): void {
    const dialogRef = this.dialog.open(LogisticsPasswordDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.logisticsAccess = true;
      }
    });
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
    // Navigate to notifications page or show all notifications
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

// Main Office Password Dialog Component
@Component({
  selector: 'app-main-office-password-dialog',
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
      Access Main Office
    </h2>
    <mat-dialog-content>
      <p class="info-text">This section is password protected.</p>
      <p class="contact-text">Contact HR management for the password.</p>

      <mat-form-field appearance="outline" style="width: 100%; margin-top: 16px;">
        <mat-label>Password</mat-label>
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
        Access
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
export class MainOfficePasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<MainOfficePasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact HR management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

// Condom Factory Password Dialog Component
@Component({
  selector: 'app-condom-factory-password-dialog',
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
      <mat-icon>factory</mat-icon>
      Access Condom Factory
    </h2>
    <mat-dialog-content>
      <p class="info-text">This section is password protected.</p>
      <p class="contact-text">Contact factory management for the password.</p>

      <mat-form-field appearance="outline" style="width: 100%; margin-top: 16px;">
        <mat-label>Password</mat-label>
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
        Access
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
export class CondomFactoryPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<CondomFactoryPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact factory management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

// Sanitary Pads Password Dialog Component
@Component({
  selector: 'app-sanitary-pads-password-dialog',
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
      <mat-icon>local_hospital</mat-icon>
      Access Sanitary Pads
    </h2>
    <mat-dialog-content>
      <p class="info-text">This section is password protected.</p>
      <p class="contact-text">Contact production management for the password.</p>

      <mat-form-field appearance="outline" style="width: 100%; margin-top: 16px;">
        <mat-label>Password</mat-label>
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
        Access
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
export class SanitaryPadsPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<SanitaryPadsPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact production management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-newroad-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>location_on</mat-icon>
      Access New Road Branch
    </h2>
    <mat-dialog-content>
      <p class="info-text">This section is password protected.</p>
      <p class="contact-text">Contact branch management for the password.</p>

      <mat-form-field appearance="outline" style="width: 100%; margin-top: 16px;">
        <mat-label>Password</mat-label>
        <input matInput type="password" [(ngModel)]="password" (keyup.enter)="validatePassword()" placeholder="Enter password">
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
        Access
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
export class NewRoadPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<NewRoadPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact branch management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-captown-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>location_city</mat-icon>
      Access Captown Branch
    </h2>
    <mat-dialog-content>
      <p class="info-text">This section is password protected.</p>
      <p class="contact-text">Contact branch management for the password.</p>

      <mat-form-field appearance="outline" style="width: 100%; margin-top: 16px;">
        <mat-label>Password</mat-label>
        <input matInput type="password" [(ngModel)]="password" (keyup.enter)="validatePassword()" placeholder="Enter password">
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
        Access
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
export class CaptownPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<CaptownPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact branch management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-brionkhorspruit-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>place</mat-icon>
      Access Brionkhorspruit Branch
    </h2>
    <mat-dialog-content>
      <p class="info-text">This section is password protected.</p>
      <p class="contact-text">Contact branch management for the password.</p>

      <mat-form-field appearance="outline" style="width: 100%; margin-top: 16px;">
        <mat-label>Password</mat-label>
        <input matInput type="password" [(ngModel)]="password" (keyup.enter)="validatePassword()" placeholder="Enter password">
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
        Access
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
export class BrionkhorspruitPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<BrionkhorspruitPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact branch management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-portelizabeth-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>apartment</mat-icon>
      Access Port Elizabeth Branch
    </h2>
    <mat-dialog-content>
      <p class="info-text">This section is password protected.</p>
      <p class="contact-text">Contact branch management for the password.</p>

      <mat-form-field appearance="outline" style="width: 100%; margin-top: 16px;">
        <mat-label>Password</mat-label>
        <input matInput type="password" [(ngModel)]="password" (keyup.enter)="validatePassword()" placeholder="Enter password">
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
        Access
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
export class PortElizabethPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<PortElizabethPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact branch management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-logistics-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>local_shipping</mat-icon>
      Access Logistics
    </h2>
    <mat-dialog-content>
      <p class="info-text">This section is password protected.</p>
      <p class="contact-text">Contact logistics management for the password.</p>

      <mat-form-field appearance="outline" style="width: 100%; margin-top: 16px;">
        <mat-label>Password</mat-label>
        <input matInput type="password" [(ngModel)]="password" (keyup.enter)="validatePassword()" placeholder="Enter password">
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
        Access
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
export class LogisticsPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<LogisticsPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact logistics management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-training-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>school</mat-icon>
      Access Training Center
    </h2>
    <mat-dialog-content>
      <p class="info-text">This section is password protected.</p>
      <p class="contact-text">Contact HR or training coordinator for the password.</p>

      <mat-form-field appearance="outline" style="width: 100%; margin-top: 16px;">
        <mat-label>Password</mat-label>
        <input matInput type="password" [(ngModel)]="password" (keyup.enter)="validatePassword()" placeholder="Enter password">
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
        Access
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
export class TrainingPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<TrainingPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact HR or training coordinator.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
