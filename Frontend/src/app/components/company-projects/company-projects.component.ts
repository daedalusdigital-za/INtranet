import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { environment } from '../../../environments/environment';

interface CompanyProject {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
  status: 'active' | 'planning' | 'on-hold' | 'completed';
  progress: number;
  category: string;
  lead?: string;
  startDate?: string;
  targetDate?: string;
  stats: { label: string; value: string }[];
}

@Component({
  selector: 'app-company-projects',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="projects-container">
      <div class="page-header">
        <div class="header-content">
          <div class="header-text">
            <h1>
              <mat-icon class="header-icon">assignment</mat-icon>
              Company Projects
            </h1>
            <p class="subtitle">Active projects and initiatives across the organisation</p>
          </div>
          <div class="header-stats">
            <div class="header-stat">
              <span class="stat-number">{{ projects.length }}</span>
              <span class="stat-label">Total Projects</span>
            </div>
            <div class="header-stat">
              <span class="stat-number">{{ getActiveCount() }}</span>
              <span class="stat-label">Active</span>
            </div>
            <div class="header-stat">
              <span class="stat-number">{{ getAverageProgress() }}%</span>
              <span class="stat-label">Avg Progress</span>
            </div>
          </div>
        </div>
      </div>

      @if (selectedProject) {
        <!-- Project Detail View -->
        <div class="project-detail">
          <div class="detail-header">
            <button mat-raised-button (click)="clearSelection()">
              <mat-icon>arrow_back</mat-icon>
              Back to Projects
            </button>
            <h2>{{ selectedProject.name }}</h2>
            <mat-chip [class]="'status-chip status-' + selectedProject.status">
              {{ selectedProject.status | titlecase }}
            </mat-chip>
          </div>

          <div class="detail-content">
            <div class="detail-overview">
              <div class="detail-card" [style.border-left-color]="selectedProject.color">
                <h3>Project Overview</h3>
                <p class="detail-description">{{ selectedProject.description }}</p>
                <div class="detail-meta">
                  @if (selectedProject.lead) {
                    <div class="meta-item">
                      <mat-icon>person</mat-icon>
                      <span>Project Lead: {{ selectedProject.lead }}</span>
                    </div>
                  }
                  @if (selectedProject.startDate) {
                    <div class="meta-item">
                      <mat-icon>event</mat-icon>
                      <span>Started: {{ selectedProject.startDate }}</span>
                    </div>
                  }
                  @if (selectedProject.targetDate) {
                    <div class="meta-item">
                      <mat-icon>flag</mat-icon>
                      <span>Target: {{ selectedProject.targetDate }}</span>
                    </div>
                  }
                </div>
                <div class="progress-section">
                  <div class="progress-header">
                    <span>Overall Progress</span>
                    <span class="progress-value">{{ selectedProject.progress }}%</span>
                  </div>
                  <mat-progress-bar mode="determinate" [value]="selectedProject.progress" [color]="selectedProject.progress >= 75 ? 'primary' : selectedProject.progress >= 40 ? 'accent' : 'warn'"></mat-progress-bar>
                </div>
              </div>
            </div>

            <div class="detail-stats-grid">
              @for (stat of selectedProject.stats; track stat.label) {
                <div class="detail-stat-card">
                  <div class="stat-value">{{ stat.value }}</div>
                  <div class="stat-label">{{ stat.label }}</div>
                </div>
              }
            </div>

            <div class="coming-soon-banner">
              <mat-icon>construction</mat-icon>
              <div>
                <h3>Project Management Features Coming Soon</h3>
                <p>Task tracking, milestones, team assignments, document uploads, and reporting will be available here.</p>
              </div>
            </div>
          </div>
        </div>
      } @else {
        <!-- Projects Grid -->
        <div class="projects-grid">
          @for (project of projects; track project.id) {
            <div class="project-card" (click)="selectProject(project)">
              <div class="card-gradient" [style.background]="project.gradient"></div>
              <div class="card-content">
                <div class="card-header">
                  <div class="card-icon" [style.background]="project.color + '22'" [style.color]="project.color">
                    <mat-icon>{{ project.icon }}</mat-icon>
                  </div>
                  <mat-chip [class]="'status-chip status-' + project.status" size="small">
                    {{ project.status | titlecase }}
                  </mat-chip>
                </div>

                <h2 class="card-title">{{ project.name }}</h2>
                <p class="card-description">{{ project.description }}</p>
                <span class="card-category">
                  <mat-icon>category</mat-icon>
                  {{ project.category }}
                </span>

                <div class="card-stats">
                  @for (stat of project.stats.slice(0, 2); track stat.label) {
                    <div class="card-stat">
                      <span class="stat-value">{{ stat.value }}</span>
                      <span class="stat-label">{{ stat.label }}</span>
                    </div>
                  }
                </div>

                <div class="card-progress">
                  <div class="progress-info">
                    <span>Progress</span>
                    <span class="progress-pct">{{ project.progress }}%</span>
                  </div>
                  <mat-progress-bar mode="determinate" [value]="project.progress" [color]="project.progress >= 75 ? 'primary' : project.progress >= 40 ? 'accent' : 'warn'"></mat-progress-bar>
                </div>

                <button mat-raised-button class="card-action-btn" [style.background]="project.color" style="color: white;">
                  <mat-icon>arrow_forward</mat-icon>
                  Open Project
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    .projects-container {
      padding: 80px;
      max-width: 1400px;
      margin: 0 auto;
      min-height: calc(100vh - 64px);
    }

    .page-header {
      margin-bottom: 32px;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 20px;
    }

    .header-text h1 {
      font-size: 2.5rem;
      font-weight: 600;
      color: white;
      margin: 0 0 8px 0;
      display: flex;
      align-items: center;
      gap: 12px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .header-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: white;
    }

    .subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 1.1rem;
      margin: 0;
    }

    .header-stats {
      display: flex;
      gap: 24px;
    }

    .header-stat {
      text-align: center;
      padding: 12px 20px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      min-width: 100px;
    }

    .header-stat .stat-number {
      display: block;
      font-size: 24px;
      font-weight: 700;
      color: white;
    }

    .header-stat .stat-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Projects Grid */
    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 24px;
    }

    .project-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 20px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      position: relative;
    }

    .project-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
    }

    .card-gradient {
      height: 8px;
      width: 100%;
    }

    .card-content {
      padding: 24px;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .card-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .card-title {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0 0 8px 0;
    }

    .card-description {
      color: #666;
      font-size: 14px;
      line-height: 1.5;
      margin: 0 0 12px 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-category {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #888;
      background: #f5f5f5;
      padding: 4px 10px;
      border-radius: 20px;
      margin-bottom: 16px;
    }

    .card-category mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .card-stats {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
      padding: 12px 0;
      border-top: 1px solid #f0f0f0;
    }

    .card-stat .stat-value {
      display: block;
      font-size: 18px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .card-stat .stat-label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .card-progress {
      margin-bottom: 16px;
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 13px;
      color: #666;
    }

    .progress-pct {
      font-weight: 600;
      color: #333;
    }

    .card-action-btn {
      width: 100%;
      border-radius: 10px !important;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    /* Status Chips */
    .status-chip {
      font-size: 11px !important;
      font-weight: 600 !important;
      min-height: 24px !important;
      padding: 0 10px !important;
    }

    .status-active {
      background: #e8f5e9 !important;
      color: #2e7d32 !important;
    }

    .status-planning {
      background: #fff3e0 !important;
      color: #ef6c00 !important;
    }

    .status-on-hold {
      background: #fce4ec !important;
      color: #c62828 !important;
    }

    .status-completed {
      background: #e3f2fd !important;
      color: #1565c0 !important;
    }

    /* Project Detail View */
    .project-detail {
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }

    .detail-header h2 {
      font-size: 24px;
      font-weight: 700;
      color: white;
      margin: 0;
      flex: 1;
      text-shadow: 1px 1px 3px rgba(0,0,0,0.2);
    }

    .detail-header button {
      background: rgba(255,255,255,0.2) !important;
      color: white !important;
      backdrop-filter: blur(10px);
    }

    .detail-content {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .detail-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      border-left: 4px solid;
    }

    .detail-card h3 {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0 0 12px 0;
    }

    .detail-description {
      color: #555;
      font-size: 15px;
      line-height: 1.7;
      margin: 0 0 20px 0;
    }

    .detail-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 24px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #666;
      font-size: 14px;
    }

    .meta-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #999;
    }

    .progress-section {
      padding-top: 16px;
      border-top: 1px solid #f0f0f0;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
      color: #666;
    }

    .progress-value {
      font-weight: 700;
      color: #333;
      font-size: 16px;
    }

    .detail-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
    }

    .detail-stat-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .detail-stat-card .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: #5c6bc0;
    }

    .detail-stat-card .stat-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }

    .coming-soon-banner {
      display: flex;
      align-items: center;
      gap: 20px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 28px;
      border: 1px dashed rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(10px);
    }

    .coming-soon-banner mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: white;
    }

    .coming-soon-banner h3 {
      font-size: 16px;
      font-weight: 700;
      color: white;
      margin: 0 0 6px 0;
    }

    .coming-soon-banner p {
      color: rgba(255, 255, 255, 0.85);
      font-size: 14px;
      margin: 0;
      line-height: 1.5;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .projects-container {
        padding: 20px;
      }

      .header-content {
        flex-direction: column;
      }

      .header-stats {
        width: 100%;
        justify-content: space-between;
      }

      .projects-grid {
        grid-template-columns: 1fr;
      }

      .detail-stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `]
})
export class CompanyProjectsComponent implements OnInit {
  projects: CompanyProject[] = [];
  selectedProject: CompanyProject | null = null;

  constructor(
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    // Static project definitions for now - can be moved to backend later
    this.projects = [
      {
        id: 'condoms',
        name: 'Condoms Project',
        description: 'National condom distribution and awareness initiative. Managing supply chain, distribution logistics, and community outreach programs across all provinces.',
        icon: 'health_and_safety',
        color: '#e91e63',
        gradient: 'linear-gradient(135deg, #e91e63 0%, #ad1457 100%)',
        status: 'active',
        progress: 0,
        category: 'Healthcare Distribution',
        lead: 'TBD',
        startDate: 'March 2026',
        targetDate: 'Ongoing',
        stats: [
          { label: 'Provinces', value: '9' },
          { label: 'Distribution Points', value: 'TBD' },
          { label: 'Monthly Target', value: 'TBD' },
          { label: 'Compliance', value: 'TBD' }
        ]
      },
      {
        id: 'hba1c',
        name: 'HBA1C Project',
        description: 'Glycated haemoglobin (HbA1c) testing and diabetes management project. Providing screening services and monitoring supplies to healthcare facilities nationwide.',
        icon: 'biotech',
        color: '#2196f3',
        gradient: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)',
        status: 'active',
        progress: 0,
        category: 'Medical Diagnostics',
        lead: 'TBD',
        startDate: 'March 2026',
        targetDate: 'Ongoing',
        stats: [
          { label: 'Facilities', value: 'TBD' },
          { label: 'Tests Supplied', value: 'TBD' },
          { label: 'Regions', value: 'TBD' },
          { label: 'Compliance', value: 'TBD' }
        ]
      },
      {
        id: 'sanitary-pads',
        name: 'Sanitary Pads Project',
        description: 'Sanitary pad distribution programme supporting dignity and school attendance for girls. Partnering with schools and community organisations for equitable distribution.',
        icon: 'volunteer_activism',
        color: '#9c27b0',
        gradient: 'linear-gradient(135deg, #9c27b0 0%, #6a1b9a 100%)',
        status: 'active',
        progress: 0,
        category: 'Social Impact',
        lead: 'TBD',
        startDate: 'March 2026',
        targetDate: 'Ongoing',
        stats: [
          { label: 'Schools', value: 'TBD' },
          { label: 'Beneficiaries', value: 'TBD' },
          { label: 'Provinces', value: 'TBD' },
          { label: 'Partners', value: 'TBD' }
        ]
      }
    ];
  }

  selectProject(project: CompanyProject): void {
    this.selectedProject = project;
  }

  clearSelection(): void {
    this.selectedProject = null;
  }

  getActiveCount(): number {
    return this.projects.filter(p => p.status === 'active').length;
  }

  getAverageProgress(): number {
    if (this.projects.length === 0) return 0;
    return Math.round(this.projects.reduce((sum, p) => sum + p.progress, 0) / this.projects.length);
  }
}
