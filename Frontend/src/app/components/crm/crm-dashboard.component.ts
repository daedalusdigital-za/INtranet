import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { CrmService, OperatingCompany, CrmDashboard, PipelineStage, AgentPerformance } from '../../services/crm/crm.service';

@Component({
  selector: 'app-crm-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatBadgeModule,
    MatTooltipModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="crm-dashboard">
      <!-- Company Switcher Header -->
      <div class="dashboard-header">
        <div class="header-left">
          <h1>CRM Dashboard</h1>
          @if (currentCompany()) {
            <div class="company-badge" [style.background-color]="currentCompany()?.primaryColor || '#1976d2'">
              {{ currentCompany()?.code }}
            </div>
          }
        </div>

        <!-- Company Switcher -->
        <div class="company-switcher">
          <button mat-raised-button [matMenuTriggerFor]="companyMenu" class="company-button"
                  [style.background-color]="currentCompany()?.primaryColor || '#1976d2'">
            <mat-icon>business</mat-icon>
            <span>{{ currentCompany()?.name || 'Select Company' }}</span>
            <mat-icon>arrow_drop_down</mat-icon>
          </button>
          <mat-menu #companyMenu="matMenu">
            @for (company of companies(); track company.operatingCompanyId) {
              <button mat-menu-item (click)="switchCompany(company)"
                      [class.active-company]="company.operatingCompanyId === currentCompany()?.operatingCompanyId">
                <div class="company-menu-item">
                  <div class="company-color-dot" [style.background-color]="company.primaryColor"></div>
                  <div class="company-info">
                    <span class="company-name">{{ company.name }}</span>
                    <span class="company-role">{{ company.userRole }}</span>
                  </div>
                  @if (company.isPrimaryCompany) {
                    <mat-icon class="primary-icon">star</mat-icon>
                  }
                </div>
              </button>
            }
          </mat-menu>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="50"></mat-spinner>
        </div>
      } @else if (noCompaniesAssigned()) {
        <div class="no-companies-container">
          <mat-card class="no-companies-card">
            <mat-card-content>
              <mat-icon class="no-companies-icon">business_center</mat-icon>
              <h2>No Operating Companies Assigned</h2>
              <p>You don't have access to any operating companies yet.</p>
              <p>Please contact your administrator to be assigned to a company.</p>
            </mat-card-content>
          </mat-card>
        </div>
      } @else {
        <!-- Stats Grid -->
        <div class="stats-grid">
          <mat-card class="stat-card" routerLink="/crm/leads" [queryParams]="{filter: 'all'}">
            <mat-card-content>
              <div class="stat-icon total">
                <mat-icon>people</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ dashboard()?.totalLeads || 0 }}</span>
                <span class="stat-label">Total Leads</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card clickable" routerLink="/crm/leads" [queryParams]="{filter: 'unassigned'}">
            <mat-card-content>
              <div class="stat-icon unassigned">
                <mat-icon>person_off</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ dashboard()?.unassignedLeads || 0 }}</span>
                <span class="stat-label">Unassigned</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card clickable" routerLink="/crm/leads" [queryParams]="{filter: 'callbacks'}">
            <mat-card-content>
              <div class="stat-icon callbacks">
                <mat-icon>schedule</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ dashboard()?.callbacksDueToday || 0 }}</span>
                <span class="stat-label">Callbacks Today</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card warning" routerLink="/crm/leads" [queryParams]="{filter: 'overdue'}">
            <mat-card-content>
              <div class="stat-icon overdue">
                <mat-icon>warning</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ dashboard()?.overdueCallbacks || 0 }}</span>
                <span class="stat-label">Overdue</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card" routerLink="/crm/leads" [queryParams]="{filter: 'hot'}">
            <mat-card-content>
              <div class="stat-icon hot">
                <mat-icon>local_fire_department</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ dashboard()?.hotLeads || 0 }}</span>
                <span class="stat-label">Hot Leads</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon new">
                <mat-icon>fiber_new</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ dashboard()?.newLeadsToday || 0 }}</span>
                <span class="stat-label">New Today</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon calls">
                <mat-icon>phone_in_talk</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ dashboard()?.callsMadeToday || 0 }}</span>
                <span class="stat-label">Calls Today</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card" routerLink="/crm/campaigns">
            <mat-card-content>
              <div class="stat-icon campaigns">
                <mat-icon>campaign</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ dashboard()?.activeCampaigns || 0 }}</span>
                <span class="stat-label">Active Campaigns</span>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Pipeline & Performance Section -->
        <div class="dashboard-sections">
          <!-- Pipeline Breakdown -->
          <mat-card class="pipeline-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>funnel</mat-icon>
                Sales Pipeline
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @if (dashboard()?.pipelineBreakdown?.length) {
                <div class="pipeline-stages">
                  @for (stage of dashboard()?.pipelineBreakdown; track stage.statusId) {
                    <div class="pipeline-stage" 
                         [style.border-left-color]="stage.statusColor"
                         routerLink="/crm/leads"
                         [queryParams]="{statusId: stage.statusId}">
                      <div class="stage-header">
                        <span class="stage-name">{{ stage.statusName }}</span>
                        <span class="stage-count">{{ stage.leadCount }}</span>
                      </div>
                      <div class="stage-value">
                        R{{ stage.totalValue | number:'1.0-0' }}
                      </div>
                      <div class="stage-bar">
                        <div class="stage-fill" 
                             [style.width.%]="getStagePercentage(stage)"
                             [style.background-color]="stage.statusColor">
                        </div>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="empty-state">
                  <mat-icon>analytics</mat-icon>
                  <p>No pipeline data yet</p>
                </div>
              }
            </mat-card-content>
          </mat-card>

          <!-- Agent Performance (Managers Only) -->
          @if (isManager() && dashboard()?.agentPerformance?.length) {
            <mat-card class="performance-card">
              <mat-card-header>
                <mat-card-title>
                  <mat-icon>leaderboard</mat-icon>
                  Team Performance
                </mat-card-title>
                <button mat-icon-button routerLink="/crm/manager">
                  <mat-icon>open_in_new</mat-icon>
                </button>
              </mat-card-header>
              <mat-card-content>
                <div class="agent-list">
                  @for (agent of dashboard()?.agentPerformance; track agent.agentId) {
                    <div class="agent-row">
                      <div class="agent-info">
                        <div class="agent-avatar">
                          {{ agent.agentName.charAt(0) }}
                        </div>
                        <div class="agent-details">
                          <span class="agent-name">{{ agent.agentName }}</span>
                          <span class="agent-role">{{ agent.role }}</span>
                        </div>
                      </div>
                      <div class="agent-stats">
                        <div class="agent-stat" matTooltip="Leads Assigned">
                          <mat-icon>people</mat-icon>
                          <span>{{ agent.totalLeadsAssigned }}</span>
                        </div>
                        <div class="agent-stat" matTooltip="Calls Today">
                          <mat-icon>phone</mat-icon>
                          <span>{{ agent.callsMadeToday }}</span>
                        </div>
                        <div class="agent-stat positive" matTooltip="Positive Outcomes">
                          <mat-icon>thumb_up</mat-icon>
                          <span>{{ agent.positiveOutcomesToday }}</span>
                        </div>
                        <div class="agent-stat" [class.warning]="agent.callbacksDue > 0" matTooltip="Callbacks Due">
                          <mat-icon>schedule</mat-icon>
                          <span>{{ agent.callbacksDue }}</span>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <button mat-raised-button color="primary" routerLink="/crm/leads/new">
            <mat-icon>person_add</mat-icon>
            Add New Lead
          </button>
          <button mat-raised-button routerLink="/crm/leads" [queryParams]="{filter: 'my-queue'}">
            <mat-icon>queue</mat-icon>
            My Call Queue
          </button>
          @if (isManager()) {
            <button mat-raised-button routerLink="/crm/manager">
              <mat-icon>assignment_ind</mat-icon>
              Manager Console
            </button>
            <button mat-raised-button routerLink="/crm/campaigns/new">
              <mat-icon>add_circle</mat-icon>
              New Campaign
            </button>
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

    .crm-dashboard {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
      min-height: calc(100vh - 64px);
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-left h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 500;
      color: white;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .company-badge {
      padding: 4px 12px;
      border-radius: 16px;
      color: white;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
    }

    .company-button {
      color: white !important;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .company-menu-item {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 250px;
    }

    .company-color-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .company-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .company-name {
      font-weight: 500;
    }

    .company-role {
      font-size: 12px;
      color: #666;
    }

    .primary-icon {
      color: #ffc107;
      font-size: 18px;
    }

    .active-company {
      background-color: #e3f2fd;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 60px;
      min-height: calc(100vh - 200px);
      align-items: center;
    }

    .no-companies-container {
      display: flex;
      justify-content: center;
      padding: 60px;
      min-height: calc(100vh - 200px);
      align-items: center;
    }

    .no-companies-card {
      max-width: 500px;
      text-align: center;
      padding: 40px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
    }

    .no-companies-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #1976d2;
      margin-bottom: 16px;
    }

    .no-companies-card h2 {
      margin: 0 0 16px 0;
      color: #333;
    }

    .no-companies-card p {
      color: #666;
      margin: 8px 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
    }

    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px !important;
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stat-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    .stat-icon.total { background: linear-gradient(135deg, #667eea, #764ba2); }
    .stat-icon.unassigned { background: linear-gradient(135deg, #f093fb, #f5576c); }
    .stat-icon.callbacks { background: linear-gradient(135deg, #4facfe, #00f2fe); }
    .stat-icon.overdue { background: linear-gradient(135deg, #fa709a, #fee140); }
    .stat-icon.hot { background: linear-gradient(135deg, #f5af19, #f12711); }
    .stat-icon.new { background: linear-gradient(135deg, #11998e, #38ef7d); }
    .stat-icon.calls { background: linear-gradient(135deg, #667eea, #764ba2); }
    .stat-icon.campaigns { background: linear-gradient(135deg, #5c258d, #4389a2); }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 600;
      line-height: 1.2;
    }

    .stat-label {
      font-size: 14px;
      color: #666;
    }

    .stat-card.warning .stat-value {
      color: #f44336;
    }

    .dashboard-sections {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 24px;
      margin-bottom: 24px;
    }

    .pipeline-card, .performance-card {
      height: fit-content;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
    }

    mat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px !important;
    }

    .pipeline-stages {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 16px;
    }

    .pipeline-stage {
      padding: 12px;
      border-left: 4px solid #ddd;
      background: #f9f9f9;
      border-radius: 0 8px 8px 0;
      cursor: pointer;
      transition: background 0.2s;
    }

    .pipeline-stage:hover {
      background: #f0f0f0;
    }

    .stage-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .stage-name {
      font-weight: 500;
    }

    .stage-count {
      font-size: 18px;
      font-weight: 600;
    }

    .stage-value {
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
    }

    .stage-bar {
      height: 4px;
      background: #e0e0e0;
      border-radius: 2px;
      overflow: hidden;
    }

    .stage-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.3s;
    }

    .agent-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 16px;
    }

    .agent-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .agent-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .agent-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
    }

    .agent-details {
      display: flex;
      flex-direction: column;
    }

    .agent-name {
      font-weight: 500;
    }

    .agent-role {
      font-size: 12px;
      color: #666;
    }

    .agent-stats {
      display: flex;
      gap: 16px;
    }

    .agent-stat {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 14px;
    }

    .agent-stat mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #666;
    }

    .agent-stat.positive mat-icon {
      color: #4caf50;
    }

    .agent-stat.warning mat-icon {
      color: #f44336;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      color: #666;
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
      color: #999;
    }

    .quick-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 24px;
    }

    .quick-actions button {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.9) !important;
      color: #1976d2 !important;
    }

    .quick-actions button:hover {
      background: white !important;
    }

    @media (max-width: 1200px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .dashboard-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .dashboard-sections {
        grid-template-columns: 1fr;
      }

      .agent-stats {
        display: none;
      }
    }

    @media (max-width: 480px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CrmDashboardComponent implements OnInit {
  private crmService = inject(CrmService);

  companies = this.crmService.operatingCompanies;
  currentCompany = signal<OperatingCompany | null>(null);
  dashboard = signal<CrmDashboard | null>(null);
  loading = signal(true);
  isManager = signal(false);
  noCompaniesAssigned = signal(false);

  ngOnInit() {
    this.crmService.currentCompany$.subscribe(company => {
      this.currentCompany.set(company);
      this.isManager.set(company?.userRole === 'SalesManager');
      if (company) {
        this.loadDashboard();
      }
    });

    this.crmService.getOperatingCompanies().subscribe({
      next: (companies) => {
        if (companies.length === 0) {
          // No companies assigned to this user
          this.noCompaniesAssigned.set(true);
          this.loading.set(false);
        }
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  switchCompany(company: OperatingCompany) {
    this.crmService.setCurrentCompany(company);
    this.loadDashboard();
  }

  loadDashboard() {
    const companyId = this.currentCompany()?.operatingCompanyId;
    this.loading.set(true);
    
    this.crmService.getDashboard(companyId).subscribe({
      next: (data) => {
        this.dashboard.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  getStagePercentage(stage: PipelineStage): number {
    const total = this.dashboard()?.totalLeads || 1;
    return (stage.leadCount / total) * 100;
  }
}
