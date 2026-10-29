import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { StatusChipComponent } from '../../ui/status-chip/status-chip.component';
import { HBA1CDashboardComponent } from './hba1c-dashboard/hba1c-dashboard.component';
import { CondomsDashboardComponent } from './condoms-dashboard/condoms-dashboard.component';
import { SanitaryPadsDashboardComponent } from './sanitary-pads-dashboard/sanitary-pads-dashboard.component';
import { SchoolDeliveryComponent } from './school-delivery/school-delivery.component';
import { HBA1CService } from '../../services/hba1c.service';
import { SanitaryPadsService } from '../../services/sanitary-pads.service';
import { SchoolDeliveryService } from '../../services/school-delivery.service';
import { environment } from '../../../environments/environment';

interface CompanyProject {
  id: string;
  name: string;
  /** Short name for the page header and breadcrumb, as in the sidebar. */
  shortName?: string;
  description: string;
  icon: string;
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
    MatProgressSpinnerModule,
    MatMenuModule,
    NavbarComponent,
    PageHeaderComponent,
    StatusChipComponent,
    HBA1CDashboardComponent,
    CondomsDashboardComponent,
    SanitaryPadsDashboardComponent,
    SchoolDeliveryComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="projects-container">
      <app-page-header class="projects-page-header"
                       [crumbs]="selectedProject ? ['Operations', 'Company projects', pageTitle] : ['Operations', 'Company projects']"
                       [title]="pageTitle" [subtitle]="pageSubtitle"></app-page-header>

      @if (selectedProject) {
        @if (selectedProject.id === 'condoms') {
          <!-- Condoms Production Dashboard -->
          <app-condoms-dashboard (goBack)="clearSelection()"></app-condoms-dashboard>
        } @else if (selectedProject.id === 'hba1c') {
          <!-- HBA1C Live Dashboard -->
          <app-hba1c-dashboard (goBack)="clearSelection()"></app-hba1c-dashboard>
        } @else if (selectedProject.id === 'sanitary-pads') {
          <!-- School Delivery Management (replaces old mock dashboard) -->
          <app-school-delivery (goBack)="clearSelection()"></app-school-delivery>
        } @else {
          <!-- Generic Project Detail View -->
          <div class="project-detail">
          <div class="detail-header">
            <button mat-stroked-button (click)="clearSelection()">
              <mat-icon>arrow_back</mat-icon>
              Back to Projects
            </button>
            <h2>{{ selectedProject.name }}</h2>
            <app-status-chip [status]="selectedProject.status | titlecase"></app-status-chip>
          </div>

          <div class="detail-content">
            <div class="detail-overview">
              <div class="detail-card">
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
        }
      } @else {
        <!-- Projects Grid -->
        <div class="projects-grid">
          @for (project of projects; track project.id) {
            <div class="project-card" (click)="selectProject(project)">
              <div class="card-content">
                <div class="card-header">
                  <div class="card-icon">
                    <mat-icon>{{ project.icon }}</mat-icon>
                  </div>
                  <app-status-chip [status]="project.status | titlecase"></app-status-chip>
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

                <button mat-stroked-button class="card-action-btn">
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
      background: var(--color-canvas);
      overflow-x: hidden;
    }

    .projects-container {
      padding: var(--space-5) clamp(20px, 5vw, 64px) 72px;
      max-width: 1440px;
      margin: 0 auto;
      min-height: calc(100vh - 64px);
    }

    .projects-page-header {
      margin-bottom: var(--space-5);
    }

    /* Projects Grid */
    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: var(--space-5);
    }

    .project-card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      cursor: pointer;
      transition: box-shadow 0.2s ease, border-color 0.2s ease;
      display: flex;
      flex-direction: column;
    }

    .project-card:hover {
      border-color: var(--color-line-strong);
      box-shadow: var(--shadow-md);
    }

    .card-content {
      padding: var(--space-5);
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-4);
    }

    .card-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    .card-icon mat-icon {
      font-size: var(--text-3xl);
      width: 24px;
      height: 24px;
    }

    .card-title {
      font-size: var(--text-xl);
      font-weight: 800;
      color: var(--color-text);
      margin: 0 0 var(--space-2) 0;
      letter-spacing: -0.01em;
    }

    .card-description {
      color: var(--color-text-2);
      font-size: var(--text-md);
      line-height: 1.6;
      margin: 0 0 14px 0;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-category {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--color-primary);
      background: var(--color-primary-soft);
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 18px;
      align-self: flex-start;
    }

    .card-category mat-icon {
      font-size: var(--text-md);
      width: 14px;
      height: 14px;
    }

    .card-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
      margin-bottom: 18px;
    }

    .card-stat {
      background: var(--color-canvas);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      padding: 12px 14px;
    }

    .card-stat .stat-value {
      display: block;
      font-size: var(--text-xl);
      font-weight: 800;
      color: var(--color-text);
      line-height: 1.15;
    }

    /* Big numbers shrink to fit their card instead of wrapping onto a second line (long rand
       values, narrow screens). 100cqi is the card's width; the px is its icon and padding. */
    .card-stats > .card-stat { container-type: inline-size; }
    .card-stats .card-stat .stat-value {
      white-space: nowrap;
      font-size: clamp(13px, calc((100cqi - 30px) / 8.5), 19px);
    }

    .card-stat .stat-label {
      font-size: var(--text-xs);
      color: var(--color-text-3);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-weight: 600;
    }

    .card-progress {
      margin-bottom: 18px;
      margin-top: auto;
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 7px;
      font-size: var(--text-sm);
      color: var(--color-text-3);
      font-weight: 500;
    }

    .progress-pct {
      font-weight: 700;
      color: var(--color-text);
    }

    .card-action-btn {
      width: 100%;
    }

    .card-progress ::ng-deep .mat-mdc-progress-bar {
      --mdc-linear-progress-track-height: 8px;
      --mdc-linear-progress-active-indicator-height: 8px;
      border-radius: 8px;
      overflow: hidden;
    }
    .card-progress ::ng-deep .mdc-linear-progress__buffer-bar {
      background: var(--color-surface-2);
    }

    @keyframes cardIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .project-card {
      animation: cardIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .projects-grid .project-card:nth-child(1) { animation-delay: 0.02s; }
    .projects-grid .project-card:nth-child(2) { animation-delay: 0.08s; }
    .projects-grid .project-card:nth-child(3) { animation-delay: 0.14s; }
    .projects-grid .project-card:nth-child(4) { animation-delay: 0.20s; }
    .projects-grid .project-card:nth-child(5) { animation-delay: 0.26s; }
    .projects-grid .project-card:nth-child(6) { animation-delay: 0.32s; }

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
      font-size: var(--text-2xl);
      font-weight: 700;
      color: var(--color-text);
      margin: 0;
      flex: 1;
    }

    .detail-content {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .detail-card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-left: 4px solid var(--color-primary);
      border-radius: var(--radius-lg);
      padding: 28px;
      box-shadow: var(--shadow-sm);
    }

    .detail-card h3 {
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--color-text);
      margin: 0 0 12px 0;
    }

    .detail-description {
      color: var(--color-text-2);
      font-size: var(--text-md);
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
      color: var(--color-text-2);
      font-size: var(--text-md);
    }

    .meta-item mat-icon {
      font-size: var(--text-xl);
      width: 18px;
      height: 18px;
      color: var(--color-text-3);
    }

    .progress-section {
      padding-top: 16px;
      border-top: 1px solid var(--color-line);
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: var(--text-md);
      color: var(--color-text-2);
    }

    .progress-value {
      font-weight: 700;
      color: var(--color-text);
      font-size: var(--text-lg);
    }

    .detail-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--space-4);
    }

    .detail-stat-card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      padding: 20px;
      text-align: center;
      box-shadow: var(--shadow-sm);
    }

    .detail-stat-card .stat-value {
      font-size: var(--text-2xl);
      font-weight: 700;
      color: var(--color-text);
    }

    .detail-stat-card .stat-label {
      font-size: var(--text-xs);
      color: var(--color-text-3);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }

    .coming-soon-banner {
      display: flex;
      align-items: center;
      gap: 20px;
      background: var(--color-surface-2);
      border-radius: var(--radius-lg);
      padding: 28px;
      border: 1px dashed var(--color-line-strong);
    }

    .coming-soon-banner mat-icon {
      font-size: var(--text-4xl);
      width: 32px;
      height: 32px;
      color: var(--color-text-3);
    }

    .coming-soon-banner h3 {
      font-size: var(--text-lg);
      font-weight: 700;
      color: var(--color-text);
      margin: 0 0 6px 0;
    }

    .coming-soon-banner p {
      color: var(--color-text-2);
      font-size: var(--text-md);
      margin: 0;
      line-height: 1.5;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .projects-container {
        padding: 20px;
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
    private route: ActivatedRoute,
    private http: HttpClient,
    private authService: AuthService,
    private dialog: MatDialog,
    private hba1cService: HBA1CService,
    private padsService: SanitaryPadsService,
    private sdmService: SchoolDeliveryService
  ) {}

  ngOnInit(): void {
    this.loadProjects();
    this.loadHba1cStats();
    this.loadPadsStats();

    // The selected project lives in the URL (?project=condoms) so the sidebar can link
    // straight to a project and the browser Back button returns to the overview.
    this.route.queryParamMap.subscribe(params => {
      const id = params.get('project');
      this.selectedProject = id ? this.projects.find(p => p.id === id) ?? null : null;
    });
  }

  private loadHba1cStats(): void {
    this.hba1cService.getDashboard().subscribe({
      next: (data) => {
        const hba1c = this.projects.find(p => p.id === 'hba1c');
        if (!hba1c) return;

        const sessions = data.trainingStats?.totalSessions || 0;
        const participants = data.trainingStats?.totalParticipants || 0;
        const provinces = data.provinceStats?.length || 0;
        const revenue = data.nationalTotals?.totalRevenue || 0;
        const completionRate = data.trainingStats?.completionRate || 0;
        const totalSales = data.salesStats?.totalSales || 0;
        const equipTypes = data.equipmentTypesCount || 0;
        const inventoryItems = data.inventoryStats?.totalItems || 0;

        const fmtRevenue = revenue >= 1_000_000
          ? 'R' + (revenue / 1_000_000).toFixed(1) + 'M'
          : revenue >= 1_000
          ? 'R' + (revenue / 1_000).toFixed(0) + 'K'
          : 'R' + revenue.toFixed(0);

        hba1c.progress = Math.round(completionRate);
        hba1c.stats = [
          { label: 'Training Sessions', value: sessions.toLocaleString() },
          { label: 'Participants', value: participants.toLocaleString() },
          { label: 'Provinces', value: provinces.toString() },
          { label: 'Revenue', value: fmtRevenue }
        ];
      },
      error: () => { /* keep static defaults */ }
    });
  }

  loadProjects(): void {
    // Static project definitions for now - can be moved to backend later
    this.projects = [
      {
        id: 'condoms',
        name: 'Condoms Project',
        shortName: 'Condoms',
        description: 'National condom stock and distribution initiative. Tracking daily stock schedules across all scent variants, batch codes, and product types.',
        icon: 'health_and_safety',
        status: 'active',
        progress: 45,
        category: 'Healthcare Stock',
        lead: 'Stock Team',
        startDate: 'March 2026',
        targetDate: 'Ongoing',
        stats: [
          { label: 'Batches', value: '90' },
          { label: 'Scent Variants', value: '5' },
          { label: 'Schedule Days', value: '7' },
          { label: 'Total Units', value: '165K+' }
        ]
      },
      {
        id: 'hba1c',
        name: 'HBA1C Project',
        shortName: 'HBA1C',
        description: 'Glycated haemoglobin (HbA1c) testing and diabetes management project. National training, equipment distribution, inventory management and sales tracking across 9 provinces.',
        icon: 'biotech',
        status: 'active',
        progress: 41,
        category: 'Medical Diagnostics',
        lead: 'National Team',
        startDate: 'March 2026',
        targetDate: 'Ongoing',
        stats: [
          { label: 'Training Sessions', value: '276' },
          { label: 'Participants', value: '5,146' },
          { label: 'Provinces', value: '9' },
          { label: 'Revenue', value: 'R109.9M' }
        ]
      },
      {
        id: 'sanitary-pads',
        name: 'Sanitary Pads Project',
        shortName: 'Sanitary pads',
        description: 'Sanitary Pads Dignity Programme with the Department of Basic Education — managing the delivery of sanitary pads to schools across Western Cape, Eastern Cape and KwaZulu-Natal to keep girls in class every day.',
        icon: 'volunteer_activism',
        status: 'active',
        progress: 65,
        category: 'Social Impact',
        lead: 'School Delivery Team',
        startDate: 'June 2025',
        targetDate: 'Ongoing',
        stats: [
          { label: 'Provinces', value: '—' },
          { label: 'Districts', value: '—' },
          { label: 'Schools', value: '—' },
          { label: 'Girls / Month', value: '—' }
        ]
      }
    ];
  }

  private loadPadsStats(): void {
    const pads = this.projects.find(p => p.id === 'sanitary-pads');
    if (!pads) return;

    const provinces = this.sdmService.provinces;
    const numProvinces = provinces.length;
    const totalDistricts = provinces.reduce((sum, p) => sum + (p.districts || 0), 0);
    const totalSchools = provinces.reduce((sum, p) => sum + (p.schools || 0), 0);
    const totalGirls = provinces.reduce((sum, p) => sum + (p.girlsPerMonth || 0), 0);

    const fmtCompact = (n: number): string => {
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
      return n.toLocaleString();
    };

    pads.stats = [
      { label: 'Provinces', value: numProvinces.toString() },
      { label: 'Districts', value: totalDistricts.toString() },
      { label: 'Schools', value: fmtCompact(totalSchools) },
      { label: 'Girls / Month', value: fmtCompact(totalGirls) }
    ];
  }

  selectProject(project: CompanyProject): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { project: project.id } });
  }

  clearSelection(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { project: null } });
  }

  /** Page header title: the open project's short name, or the overview. */
  get pageTitle(): string {
    const p = this.selectedProject;
    return p ? (p.shortName ?? p.name) : 'Company projects';
  }

  /** Page header subtitle: the open project's category and lead, or the overview totals. */
  get pageSubtitle(): string {
    const p = this.selectedProject;
    if (p) return [p.category, p.lead].filter(Boolean).join(' · ');
    const n = this.projects.length;
    return `${n} project${n === 1 ? '' : 's'} · ${this.getActiveCount()} active · ${this.getAverageProgress()}% average progress`;
  }

  getActiveCount(): number {
    return this.projects.filter(p => p.status === 'active').length;
  }

  getAverageProgress(): number {
    if (this.projects.length === 0) return 0;
    return Math.round(this.projects.reduce((sum, p) => sum + p.progress, 0) / this.projects.length);
  }
}
