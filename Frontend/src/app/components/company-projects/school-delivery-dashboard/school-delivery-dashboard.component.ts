import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

interface FeatureModule {
  name: string;
  icon: string;
  status: 'complete' | 'in-progress' | 'planned';
  features: string[];
}

interface TechItem {
  name: string;
  version: string;
  purpose: string;
  category: string;
}

interface ApiCategory {
  name: string;
  endpoints: number;
  status: 'working' | 'partial' | 'planned';
}

@Component({
  selector: 'app-school-delivery-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTabsModule,
    MatTooltipModule
  ],
  template: `
    <div class="dashboard-container">
      <!-- Header -->
      <div class="dash-header">
        <button mat-raised-button class="back-btn" (click)="goBack.emit()">
          <mat-icon>arrow_back</mat-icon>
          Back to Projects
        </button>
        <div class="header-title">
          <div class="title-row">
            <div class="project-icon">
              <mat-icon>local_shipping</mat-icon>
            </div>
            <div>
              <h1>School Delivery Management System</h1>
              <p class="header-subtitle">SA Department of Women's Sanitary Dignity Programme — Western Cape</p>
            </div>
          </div>
          <div class="header-badges">
            <span class="badge badge-complete">
              <mat-icon>check_circle</mat-icon> Production Ready
            </span>
            <span class="badge badge-azure">
              <mat-icon>cloud</mat-icon> Azure Deployed
            </span>
            <span class="badge badge-tests">
              <mat-icon>verified</mat-icon> 98.7% Tests Passing
            </span>
          </div>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card" *ngFor="let kpi of kpis">
          <div class="kpi-icon" [style.background]="kpi.bg" [style.color]="kpi.color">
            <mat-icon>{{ kpi.icon }}</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-value">{{ kpi.value }}</span>
            <span class="kpi-label">{{ kpi.label }}</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <mat-tab-group class="detail-tabs" animationDuration="200ms">
        <!-- Overview Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>dashboard</mat-icon>
            <span>Overview</span>
          </ng-template>
          <div class="tab-content">
            <div class="overview-grid">
              <!-- Project Summary -->
              <div class="info-card full-width">
                <div class="info-card-header">
                  <mat-icon>description</mat-icon>
                  <h3>Executive Summary</h3>
                </div>
                <p class="summary-text">
                  The School Delivery Management System is a comprehensive web application developed to support the
                  <strong>South African Department of Women's Sanitary Dignity Programme</strong>. The system manages the
                  distribution and delivery of sanitary pads to schools across the Western Cape province.
                </p>
                <p class="summary-text">
                  The application integrates with the <strong>Cape Winelands Delivery Management API</strong> and provides
                  real-time tracking, SMS notifications, and comprehensive reporting capabilities. It is fully functional
                  with all core features implemented, tested, and deployed to Azure.
                </p>
              </div>

              <!-- Objectives -->
              <div class="info-card">
                <div class="info-card-header">
                  <mat-icon>flag</mat-icon>
                  <h3>Project Objectives</h3>
                </div>
                <div class="objectives-list">
                  <div class="objective-item" *ngFor="let obj of objectives">
                    <mat-icon class="obj-check">check_circle</mat-icon>
                    <span>{{ obj }}</span>
                  </div>
                </div>
              </div>

              <!-- Business Value -->
              <div class="info-card">
                <div class="info-card-header">
                  <mat-icon>trending_up</mat-icon>
                  <h3>Business Value</h3>
                </div>
                <div class="value-items">
                  <div class="value-item">
                    <div class="value-metric">80%</div>
                    <div class="value-desc">Reduction in manual data entry through automated delivery tracking</div>
                  </div>
                  <div class="value-item">
                    <div class="value-metric">650+</div>
                    <div class="value-desc">Schools managed in centralized database</div>
                  </div>
                  <div class="value-item">
                    <div class="value-metric">Zero</div>
                    <div class="value-desc">Paper filing with digital document storage</div>
                  </div>
                  <div class="value-item">
                    <div class="value-metric">Real-time</div>
                    <div class="value-desc">Dashboards for data-driven decision making</div>
                  </div>
                </div>
              </div>

              <!-- Deployment Info -->
              <div class="info-card">
                <div class="info-card-header">
                  <mat-icon>cloud_upload</mat-icon>
                  <h3>Deployment</h3>
                </div>
                <div class="deploy-grid">
                  <div class="deploy-item">
                    <span class="deploy-label">Hosting</span>
                    <span class="deploy-value">Microsoft Azure</span>
                  </div>
                  <div class="deploy-item">
                    <span class="deploy-label">Frontend</span>
                    <span class="deploy-value">Azure Static Web Apps</span>
                  </div>
                  <div class="deploy-item">
                    <span class="deploy-label">Backend API</span>
                    <span class="deploy-value">Azure App Service (East US 2)</span>
                  </div>
                  <div class="deploy-item">
                    <span class="deploy-label">SSR Support</span>
                    <span class="deploy-value">Available (Optional)</span>
                  </div>
                  <div class="deploy-item">
                    <span class="deploy-label">Build Config</span>
                    <span class="deploy-value">Production Optimized</span>
                  </div>
                  <div class="deploy-item">
                    <span class="deploy-label">Container</span>
                    <span class="deploy-value">Docker Available</span>
                  </div>
                </div>
              </div>

              <!-- User Roles -->
              <div class="info-card">
                <div class="info-card-header">
                  <mat-icon>people</mat-icon>
                  <h3>User Roles</h3>
                </div>
                <div class="roles-list">
                  <div class="role-row" *ngFor="let role of roles">
                    <span class="role-id">{{ role.id }}</span>
                    <span class="role-name">{{ role.name }}</span>
                    <span class="role-access">{{ role.access }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Features Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>widgets</mat-icon>
            <span>Features</span>
          </ng-template>
          <div class="tab-content">
            <div class="modules-grid">
              <div class="module-card" *ngFor="let mod of modules">
                <div class="module-header">
                  <div class="module-icon-wrap">
                    <mat-icon>{{ mod.icon }}</mat-icon>
                  </div>
                  <div>
                    <h4>{{ mod.name }}</h4>
                    <mat-chip class="status-chip status-complete" size="small">Complete</mat-chip>
                  </div>
                </div>
                <ul class="feature-list">
                  <li *ngFor="let feat of mod.features">
                    <mat-icon class="feat-check">check</mat-icon>
                    {{ feat }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Tech Stack Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>code</mat-icon>
            <span>Tech Stack</span>
          </ng-template>
          <div class="tab-content">
            <div class="tech-categories">
              <div class="tech-category" *ngFor="let cat of techCategories">
                <h3 class="tech-cat-title">{{ cat.name }}</h3>
                <div class="tech-items">
                  <div class="tech-item" *ngFor="let item of getTechByCategory(cat.name)">
                    <span class="tech-name">{{ item.name }}</span>
                    <span class="tech-version" *ngIf="item.version">{{ item.version }}</span>
                    <span class="tech-purpose">{{ item.purpose }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- API Status Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>api</mat-icon>
            <span>API Status</span>
          </ng-template>
          <div class="tab-content">
            <div class="api-header-info">
              <div class="api-url-card">
                <mat-icon>link</mat-icon>
                <div>
                  <span class="api-label">Cape Winelands Delivery Management API</span>
                  <span class="api-url">eastus2-01.azurewebsites.net</span>
                </div>
                <span class="api-rate">95.7% Success Rate</span>
              </div>
            </div>
            <div class="api-grid">
              <div class="api-card" *ngFor="let api of apiCategories">
                <div class="api-card-top">
                  <span class="api-name">{{ api.name }}</span>
                  <span class="api-status-badge working">
                    <mat-icon>check_circle</mat-icon> Working
                  </span>
                </div>
                <div class="api-endpoints">{{ api.endpoints }} endpoints</div>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Testing Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>bug_report</mat-icon>
            <span>Testing</span>
          </ng-template>
          <div class="tab-content">
            <div class="test-summary-grid">
              <div class="test-card pass">
                <div class="test-number">76</div>
                <div class="test-label">Passing</div>
              </div>
              <div class="test-card fail">
                <div class="test-number">1</div>
                <div class="test-label">Failing</div>
              </div>
              <div class="test-card total">
                <div class="test-number">77</div>
                <div class="test-label">Total Tests</div>
              </div>
              <div class="test-card rate">
                <div class="test-number">98.7%</div>
                <div class="test-label">Success Rate</div>
              </div>
            </div>
            <div class="test-progress-bar">
              <div class="test-pass-bar" style="width: 98.7%"></div>
            </div>
            <div class="test-coverage">
              <h3>Test Coverage Areas</h3>
              <div class="coverage-list">
                <div class="coverage-item pass">
                  <mat-icon>check_circle</mat-icon> Component creation tests
                </div>
                <div class="coverage-item pass">
                  <mat-icon>check_circle</mat-icon> Service injection tests
                </div>
                <div class="coverage-item pass">
                  <mat-icon>check_circle</mat-icon> API integration tests
                </div>
                <div class="coverage-item pass">
                  <mat-icon>check_circle</mat-icon> Authentication flow tests
                </div>
                <div class="coverage-item warn">
                  <mat-icon>warning</mat-icon> Animation module tests (1 known non-critical issue)
                </div>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .dashboard-container {
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .dash-header {
      margin-bottom: 28px;
    }

    .back-btn {
      background: rgba(255,255,255,0.2) !important;
      color: white !important;
      backdrop-filter: blur(10px);
      margin-bottom: 20px;
    }

    .header-title {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .project-icon {
      width: 56px;
      height: 56px;
      background: rgba(255,255,255,0.2);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
    }

    .project-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: white;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      color: white;
      margin: 0;
      text-shadow: 1px 1px 3px rgba(0,0,0,0.2);
    }

    .header-subtitle {
      color: rgba(255,255,255,0.85);
      margin: 4px 0 0;
      font-size: 14px;
    }

    .header-badges {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .badge-complete {
      background: rgba(76, 175, 80, 0.25);
      color: #a5d6a7;
      border: 1px solid rgba(76, 175, 80, 0.4);
    }

    .badge-azure {
      background: rgba(33, 150, 243, 0.25);
      color: #90caf9;
      border: 1px solid rgba(33, 150, 243, 0.4);
    }

    .badge-tests {
      background: rgba(255, 193, 7, 0.25);
      color: #ffe082;
      border: 1px solid rgba(255, 193, 7, 0.4);
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }

    .kpi-card {
      background: rgba(255,255,255,0.95);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    }

    .kpi-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .kpi-icon mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .kpi-info {
      display: flex;
      flex-direction: column;
    }

    .kpi-value {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a2e;
      line-height: 1.2;
    }

    .kpi-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Tabs */
    .detail-tabs {
      background: rgba(255,255,255,0.95);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    }

    ::ng-deep .detail-tabs .mat-mdc-tab-header {
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    ::ng-deep .detail-tabs .mat-mdc-tab .mdc-tab__text-label {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .tab-content {
      padding: 28px;
    }

    /* Overview Grid */
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .info-card {
      background: #f8f9fa;
      border-radius: 16px;
      padding: 24px;
      border: 1px solid #e8e8e8;
    }

    .info-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }

    .info-card-header mat-icon {
      color: #00897b;
    }

    .info-card-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .summary-text {
      color: #555;
      font-size: 14px;
      line-height: 1.7;
      margin: 0 0 12px;
    }

    .summary-text:last-child {
      margin-bottom: 0;
    }

    /* Objectives */
    .objectives-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .objective-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: #444;
    }

    .obj-check {
      color: #4caf50;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* Business Value */
    .value-items {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .value-item {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .value-metric {
      font-size: 16px;
      font-weight: 700;
      color: #00897b;
      min-width: 70px;
      flex-shrink: 0;
    }

    .value-desc {
      font-size: 13px;
      color: #555;
      line-height: 1.4;
    }

    /* Deploy Grid */
    .deploy-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .deploy-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .deploy-label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .deploy-value {
      font-size: 13px;
      font-weight: 600;
      color: #333;
    }

    /* Roles */
    .roles-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .role-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: white;
      border-radius: 8px;
      font-size: 13px;
    }

    .role-id {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: #00897b;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .role-name {
      font-weight: 600;
      color: #333;
      min-width: 120px;
    }

    .role-access {
      color: #888;
      font-size: 12px;
    }

    /* Modules Grid */
    .modules-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }

    .module-card {
      background: #f8f9fa;
      border-radius: 16px;
      padding: 20px;
      border: 1px solid #e8e8e8;
    }

    .module-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }

    .module-icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #e0f2f1;
      color: #00897b;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .module-icon-wrap mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .module-header h4 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .status-chip.status-complete {
      background: #e8f5e9 !important;
      color: #2e7d32 !important;
      font-size: 10px !important;
    }

    .feature-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .feature-list li {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #555;
    }

    .feat-check {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #4caf50;
    }

    /* Tech Stack */
    .tech-categories {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .tech-cat-title {
      font-size: 15px;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0 0 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #00897b;
      display: inline-block;
    }

    .tech-items {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 10px;
    }

    .tech-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: #f8f9fa;
      border-radius: 10px;
      border: 1px solid #e8e8e8;
    }

    .tech-name {
      font-weight: 600;
      font-size: 13px;
      color: #333;
      min-width: 100px;
    }

    .tech-version {
      font-size: 11px;
      background: #e3f2fd;
      color: #1565c0;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
    }

    .tech-purpose {
      font-size: 12px;
      color: #888;
      flex: 1;
      text-align: right;
    }

    /* API Status */
    .api-header-info {
      margin-bottom: 20px;
    }

    .api-url-card {
      display: flex;
      align-items: center;
      gap: 14px;
      background: #f8f9fa;
      border-radius: 12px;
      padding: 16px 20px;
      border: 1px solid #e8e8e8;
    }

    .api-url-card mat-icon {
      color: #00897b;
    }

    .api-label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }

    .api-url {
      display: block;
      font-size: 12px;
      color: #888;
      font-family: monospace;
    }

    .api-rate {
      margin-left: auto;
      font-size: 14px;
      font-weight: 700;
      color: #4caf50;
    }

    .api-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }

    .api-card {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #e8e8e8;
    }

    .api-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .api-name {
      font-weight: 600;
      font-size: 14px;
      color: #333;
    }

    .api-status-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
    }

    .api-status-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .api-status-badge.working {
      color: #4caf50;
    }

    .api-endpoints {
      font-size: 12px;
      color: #888;
    }

    /* Testing */
    .test-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }

    .test-card {
      text-align: center;
      padding: 20px;
      border-radius: 14px;
    }

    .test-card.pass {
      background: #e8f5e9;
    }

    .test-card.fail {
      background: #fce4ec;
    }

    .test-card.total {
      background: #e3f2fd;
    }

    .test-card.rate {
      background: #e0f2f1;
    }

    .test-number {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .test-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .test-progress-bar {
      height: 12px;
      background: #fce4ec;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 24px;
    }

    .test-pass-bar {
      height: 100%;
      background: linear-gradient(90deg, #4caf50, #81c784);
      border-radius: 6px;
    }

    .test-coverage h3 {
      font-size: 15px;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0 0 14px;
    }

    .coverage-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .coverage-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      padding: 10px 14px;
      border-radius: 10px;
      background: #f8f9fa;
    }

    .coverage-item.pass mat-icon {
      color: #4caf50;
    }

    .coverage-item.warn mat-icon {
      color: #ff9800;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .overview-grid {
        grid-template-columns: 1fr;
      }

      .modules-grid {
        grid-template-columns: 1fr;
      }

      .test-summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      h1 {
        font-size: 1.5rem;
      }
    }
  `]
})
export class SchoolDeliveryDashboardComponent {
  @Output() goBack = new EventEmitter<void>();

  kpis = [
    { icon: 'school', value: '650+', label: 'Schools', bg: '#e8f5e9', color: '#2e7d32' },
    { icon: 'api', value: '44', label: 'API Endpoints', bg: '#e3f2fd', color: '#1565c0' },
    { icon: 'widgets', value: '60+', label: 'Components', bg: '#f3e5f5', color: '#7b1fa2' },
    { icon: 'build', value: '40+', label: 'Services', bg: '#fff3e0', color: '#e65100' },
    { icon: 'code', value: '50K+', label: 'Lines of Code', bg: '#e0f2f1', color: '#00695c' },
    { icon: 'verified', value: '98.7%', label: 'Test Pass Rate', bg: '#fce4ec', color: '#c62828' }
  ];

  objectives = [
    'Centralized delivery management system',
    'Real-time delivery tracking with Google Maps',
    'School database management with bulk import/export',
    'SMS notification system via Twilio',
    'Analytics and reporting with charts & exports',
    'Role-based user authentication & authorization',
    'Document management with PDF/image upload',
    'Azure cloud deployment'
  ];

  roles = [
    { id: '1', name: 'SuperAdmin', access: 'Full system access' },
    { id: '2', name: 'Admin', access: 'Administrative functions' },
    { id: '3', name: 'Viewer', access: 'Read-only access' },
    { id: '4', name: 'SchoolAdmin', access: 'School-specific management' },
    { id: '5', name: 'Teacher', access: 'Limited school access' },
    { id: '6', name: 'DeliveryDriver', access: 'Delivery operations' },
    { id: '7', name: 'Student', access: 'Minimal access' }
  ];

  modules: FeatureModule[] = [
    {
      name: 'Dashboard', icon: 'dashboard', status: 'complete',
      features: ['Statistics cards with real-time data', 'Quick action buttons', 'Delivery status overview', 'Recent activity feed', 'Analytics charts']
    },
    {
      name: 'School Management', icon: 'school', status: 'complete',
      features: ['650+ school database', 'CRUD operations', 'Bulk import/export (Excel/CSV)', 'Google Maps integration', 'District-based filtering']
    },
    {
      name: 'Delivery Management', icon: 'local_shipping', status: 'complete',
      features: ['Real-time delivery tracking', 'Status management', 'Bulk delivery creation', 'Proof of delivery uploads', 'Trip sheet generation']
    },
    {
      name: 'Order Processing', icon: 'receipt_long', status: 'complete',
      features: ['Order creation & management', 'Status tracking', 'Priority management', 'School-based filtering', 'Bulk order processing']
    },
    {
      name: 'Inventory Management', icon: 'inventory', status: 'complete',
      features: ['Stock tracking', 'Low stock alerts', 'Category-based organization', 'Stock update dialogs', 'Inventory reports']
    },
    {
      name: 'Document Management', icon: 'folder', status: 'complete',
      features: ['PDF/image upload', 'Base64 encoding for API', 'File download', 'Category organization', 'School-based filtering']
    },
    {
      name: 'SMS/Messaging Gateway', icon: 'sms', status: 'complete',
      features: ['Twilio SMS integration', 'Bulk SMS campaigns', 'SMS history tracking', 'Template management', 'Delivery notifications']
    },
    {
      name: 'Calendar & Scheduling', icon: 'event', status: 'complete',
      features: ['Monthly/weekly views', 'Event creation & editing', 'Delivery scheduling', 'Date range filtering', 'Event categorization']
    },
    {
      name: 'Reports & Analytics', icon: 'bar_chart', status: 'complete',
      features: ['Chart.js integration', 'Export to Excel/PDF', 'Date range filtering', 'District-based reports', 'Performance metrics']
    },
    {
      name: 'User Management', icon: 'manage_accounts', status: 'complete',
      features: ['User CRUD operations', 'Role-based access (7 roles)', 'Profile management', 'Password management', 'Status management']
    },
    {
      name: 'Authentication & Security', icon: 'security', status: 'complete',
      features: ['JWT token authentication', 'Auth guards', 'HTTP interceptors', 'Role-based route protection', 'Session management']
    },
    {
      name: 'Settings & Configuration', icon: 'settings', status: 'complete',
      features: ['System settings management', 'User preferences', 'Notification settings', 'Data management tools']
    }
  ];

  techStack: TechItem[] = [
    { name: 'Angular', version: '18.2.13', purpose: 'Frontend framework', category: 'Frontend' },
    { name: 'TypeScript', version: '5.4.2', purpose: 'Type-safe JavaScript', category: 'Frontend' },
    { name: 'Angular Material', version: '18.2.13', purpose: 'UI component library', category: 'Frontend' },
    { name: 'RxJS', version: '7.8.0', purpose: 'Reactive programming', category: 'Frontend' },
    { name: 'SCSS', version: '', purpose: 'Styling with custom properties', category: 'Frontend' },
    { name: 'Chart.js', version: '4.5.0', purpose: 'Analytics charts & graphs', category: 'Data & Reporting' },
    { name: 'jsPDF', version: '3.0.2', purpose: 'PDF generation', category: 'Data & Reporting' },
    { name: 'xlsx', version: '0.18.5', purpose: 'Excel import/export', category: 'Data & Reporting' },
    { name: 'html2canvas', version: '1.4.1', purpose: 'Screenshot generation', category: 'Data & Reporting' },
    { name: 'Google Maps API', version: '18.2.13', purpose: 'School locations & routes', category: 'Mapping' },
    { name: 'Node.js', version: '18+', purpose: 'Server runtime', category: 'Backend' },
    { name: 'Express', version: '5.1.0', purpose: 'Web server framework', category: 'Backend' },
    { name: 'Angular SSR', version: '18.2.20', purpose: 'Server-side rendering', category: 'Backend' },
    { name: 'Azure Static Web Apps', version: '', purpose: 'Frontend hosting', category: 'Cloud & DevOps' },
    { name: 'Azure App Service', version: '', purpose: 'Backend/API hosting', category: 'Cloud & DevOps' },
    { name: 'Azure Functions', version: '', purpose: 'Serverless API endpoints', category: 'Cloud & DevOps' },
    { name: 'Docker', version: '', purpose: 'Container deployment', category: 'Cloud & DevOps' },
    { name: 'ESLint', version: '9.35.0', purpose: 'Code linting', category: 'Dev & Quality' },
    { name: 'Jasmine', version: '5.1.0', purpose: 'Unit testing framework', category: 'Dev & Quality' },
    { name: 'Karma', version: '6.4.4', purpose: 'Test runner', category: 'Dev & Quality' }
  ];

  techCategories = [
    { name: 'Frontend' },
    { name: 'Data & Reporting' },
    { name: 'Mapping' },
    { name: 'Backend' },
    { name: 'Cloud & DevOps' },
    { name: 'Dev & Quality' }
  ];

  apiCategories: ApiCategory[] = [
    { name: 'Schools', endpoints: 5, status: 'working' },
    { name: 'Deliveries', endpoints: 6, status: 'working' },
    { name: 'Orders', endpoints: 4, status: 'working' },
    { name: 'Users', endpoints: 4, status: 'working' },
    { name: 'Vehicles', endpoints: 3, status: 'working' },
    { name: 'Documents', endpoints: 9, status: 'working' },
    { name: 'Calendar', endpoints: 3, status: 'working' },
    { name: 'Inventory', endpoints: 3, status: 'working' },
    { name: 'Settings', endpoints: 2, status: 'working' },
    { name: 'Analytics', endpoints: 1, status: 'working' },
    { name: 'SMS', endpoints: 4, status: 'working' }
  ];

  getTechByCategory(category: string): TechItem[] {
    return this.techStack.filter(t => t.category === category);
  }
}
