import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

interface DailyQty {
  date: string;
  quantity: number;
  note?: string;
}

interface BatchRow {
  batchCode: string;
  uom: string;
  dailyQuantities: DailyQty[];
}

interface ScentGroup {
  scent: string;
  type: string;
  scentGroup: string;
  batches: BatchRow[];
}

interface ScheduleSummary {
  totalBatches: number;
  femaleBatches: number;
  maleBatches: number;
  scentVariants: number;
  week1Total: number;
  week2Total: number;
  scheduleDays: number;
}

interface DashboardData {
  hasData: boolean;
  summary: {
    totalBatches: number;
    totalScents: number;
    dateRange: { from: string; to: string };
    scheduleDays: number;
    grandTotal: number;
  };
  scentBreakdown: { scent: string; batchCount: number; totalUnits: number; types: string[] }[];
  typeBreakdown: { type: string; batchCount: number; totalUnits: number; uom: string }[];
  dailyTotals: { date: string; total: number }[];
}

@Component({
  selector: 'app-condoms-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    MatTabsModule,
    MatSelectModule,
    MatFormFieldModule,
    DatePipe,
    DecimalPipe
  ],
  template: `
    <div class="dashboard-container">
      <!-- Back Button -->
      <div class="back-row">
        <button mat-raised-button (click)="goBack.emit()" class="back-btn">
          <mat-icon>arrow_back</mat-icon>
          Back to Projects
        </button>
        <h2 class="dashboard-title">
          <mat-icon class="title-icon">health_and_safety</mat-icon>
          Condoms Production Schedule
        </h2>
        <div class="title-actions">
          <mat-chip class="date-chip">
            <mat-icon>date_range</mat-icon>
            March 2026
          </mat-chip>
        </div>
      </div>

      @if (loading) {
        <div class="loading-container">
          <div class="loading-card">
            <mat-spinner diameter="48"></mat-spinner>
            <h3>Loading Production Schedule...</h3>
            <p>Fetching batch data and daily quantities</p>
          </div>
        </div>
      } @else if (error) {
        <div class="error-container">
          <mat-icon>error_outline</mat-icon>
          <h3>Failed to load production data</h3>
          <p>{{ error }}</p>
          <button mat-raised-button color="primary" (click)="loadData()">
            <mat-icon>refresh</mat-icon> Retry
          </button>
        </div>
      } @else {
        <!-- KPI Cards -->
        <div class="kpi-row">
          <div class="kpi-card kpi-pink">
            <div class="kpi-icon"><mat-icon>inventory_2</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-value">{{ dashboard?.summary?.totalBatches || 0 }}</span>
              <span class="kpi-label">Total Batches</span>
            </div>
          </div>
          <div class="kpi-card kpi-purple">
            <div class="kpi-icon"><mat-icon>female</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-value">{{ scheduleSummary?.femaleBatches || 0 }}</span>
              <span class="kpi-label">Female Batches</span>
            </div>
          </div>
          <div class="kpi-card kpi-blue">
            <div class="kpi-icon"><mat-icon>male</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-value">{{ scheduleSummary?.maleBatches || 0 }}</span>
              <span class="kpi-label">Male Batches</span>
            </div>
          </div>
          <div class="kpi-card kpi-orange">
            <div class="kpi-icon"><mat-icon>palette</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-value">{{ dashboard?.summary?.totalScents || 0 }}</span>
              <span class="kpi-label">Scent Variants</span>
            </div>
          </div>
          <div class="kpi-card kpi-green">
            <div class="kpi-icon"><mat-icon>assessment</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-value">{{ (dashboard?.summary?.grandTotal || 0) | number }}</span>
              <span class="kpi-label">Total Units (All Days)</span>
            </div>
          </div>
        </div>

        <!-- Scent Breakdown Cards -->
        <div class="scent-cards-row">
          @for (sb of dashboard?.scentBreakdown || []; track sb.scent) {
            <div class="scent-card" [style.border-left-color]="getScentColor(sb.scent)">
              <div class="scent-card-header">
                <span class="scent-emoji">{{ getScentEmoji(sb.scent) }}</span>
                <span class="scent-name">{{ sb.scent }}</span>
              </div>
              <div class="scent-card-stats">
                <div class="scs-item">
                  <span class="scs-val">{{ sb.batchCount }}</span>
                  <span class="scs-lbl">Batches</span>
                </div>
                <div class="scs-item">
                  <span class="scs-val">{{ sb.totalUnits | number }}</span>
                  <span class="scs-lbl">Total Units</span>
                </div>
                <div class="scs-item">
                  <span class="scs-val">{{ sb.types.join(', ') }}</span>
                  <span class="scs-lbl">Types</span>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Daily Total Bar Chart -->
        @if (dashboard?.dailyTotals && dashboard!.dailyTotals.length > 0) {
          <div class="chart-section">
            <h3><mat-icon>bar_chart</mat-icon> Daily Production Totals</h3>
            <div class="bar-chart">
              @for (dt of dashboard!.dailyTotals; track dt.date) {
                <div class="bar-col">
                  <span class="bar-value">{{ dt.total | number }}</span>
                  <div class="bar" [style.height.%]="getBarHeight(dt.total)" [style.background]="getBarColor(dt.date)"></div>
                  <span class="bar-label">{{ dt.date | date:'EEE' }}<br>{{ dt.date | date:'d MMM' }}</span>
                </div>
              }
            </div>
          </div>
        }

        <!-- Production Schedule Grid -->
        <div class="schedule-section">
          <div class="schedule-header">
            <h3><mat-icon>table_chart</mat-icon> Production Schedule Detail</h3>
            <div class="schedule-filters">
              <mat-form-field appearance="outline" class="filter-field">
                <mat-label>Filter by Scent</mat-label>
                <mat-select [(value)]="filterScent" (selectionChange)="applyFilter()">
                  <mat-option value="all">All Scents</mat-option>
                  @for (s of allScents; track s) {
                    <mat-option [value]="s">{{ getScentEmoji(s) }} {{ s }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="filter-field">
                <mat-label>Filter by Type</mat-label>
                <mat-select [(value)]="filterType" (selectionChange)="applyFilter()">
                  <mat-option value="all">All Types</mat-option>
                  <mat-option value="Female">Female</mat-option>
                  <mat-option value="Male">Male</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </div>

          <div class="schedule-table-wrapper">
            <table class="schedule-table">
              <thead>
                <tr>
                  <th class="col-scent">Scent</th>
                  <th class="col-type">Type</th>
                  <th class="col-batch">Batch</th>
                  <th class="col-uom">UOM</th>
                  @for (d of scheduleDates; track d) {
                    <th class="col-day" [class.weekend]="isWeekend(d)">
                      <div class="date-header">
                        <span class="day-name">{{ d | date:'EEE' }}</span>
                        <span class="day-num">{{ d | date:'dd' }}</span>
                        <span class="day-month">{{ d | date:'MMM' }}</span>
                      </div>
                    </th>
                  }
                  <th class="col-total">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (group of filteredGroups; track group.scentGroup) {
                  <!-- Scent group header -->
                  <tr class="group-header-row" [style.background]="getScentColor(group.scent) + '18'">
                    <td [attr.colspan]="4 + scheduleDates.length + 1" class="group-header-cell">
                      <span class="group-emoji">{{ getScentEmoji(group.scent) }}</span>
                      <strong>{{ group.scent }}</strong>
                      <span class="group-type-badge" [style.background]="group.type === 'Female' ? '#e91e63' : '#2196f3'">
                        {{ group.type }}
                      </span>
                      <span class="group-count">{{ group.batches.length }} batches</span>
                    </td>
                  </tr>
                  @for (batch of group.batches; track batch.batchCode; let i = $index) {
                    <tr class="batch-row" [class.even-row]="i % 2 === 0">
                      <td class="col-scent">
                        @if (i === 0) {
                          {{ group.scent }}
                        }
                      </td>
                      <td class="col-type">
                        @if (i === 0) {
                          <span class="type-badge" [class.type-female]="group.type === 'Female'" [class.type-male]="group.type === 'Male'">
                            {{ group.type }}
                          </span>
                        }
                      </td>
                      <td class="col-batch"><code>{{ batch.batchCode }}</code></td>
                      <td class="col-uom">{{ batch.uom }}</td>
                      @for (dq of batch.dailyQuantities; track dq.date) {
                        <td class="col-day" [class.zero-qty]="dq.quantity === 0" [class.has-note]="dq.note">
                          @if (dq.note) {
                            <span [matTooltip]="dq.note">{{ dq.quantity }}</span>
                          } @else {
                            {{ dq.quantity | number }}
                          }
                        </td>
                      }
                      <td class="col-total"><strong>{{ getBatchTotal(batch) | number }}</strong></td>
                    </tr>
                  }
                  <!-- Group subtotal -->
                  <tr class="subtotal-row" [style.background]="getScentColor(group.scent) + '10'">
                    <td colspan="4" class="subtotal-label">{{ group.scent }} {{ group.type }} Subtotal</td>
                    @for (d of scheduleDates; track d) {
                      <td class="col-day subtotal-val">{{ getGroupDayTotal(group, d) | number }}</td>
                    }
                    <td class="col-total subtotal-val"><strong>{{ getGroupTotal(group) | number }}</strong></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 0 24px 40px;
    }

    .back-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .back-btn {
      background: rgba(255, 255, 255, 0.15) !important;
      color: white !important;
      backdrop-filter: blur(10px);
    }

    .dashboard-title {
      color: white;
      margin: 0;
      font-size: 1.8rem;
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
    }

    .title-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .title-actions {
      display: flex;
      gap: 8px;
    }

    .date-chip {
      background: rgba(255, 255, 255, 0.2) !important;
      color: white !important;
    }

    /* Loading */
    .loading-container {
      display: flex;
      justify-content: center;
      padding: 60px 0;
    }

    .loading-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      padding: 48px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    }

    .loading-card h3 { margin: 16px 0 8px; color: #333; }
    .loading-card p { color: #666; margin: 0; }

    .error-container {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      padding: 48px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    }

    .error-container mat-icon { font-size: 48px; width: 48px; height: 48px; color: #f44336; }
    .error-container h3 { color: #333; }
    .error-container p { color: #666; }

    /* KPI Cards */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 14px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s;
    }

    .kpi-card:hover { transform: translateY(-2px); }

    .kpi-icon {
      width: 50px;
      height: 50px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .kpi-icon mat-icon { font-size: 26px; width: 26px; height: 26px; color: white; }

    .kpi-pink .kpi-icon { background: linear-gradient(135deg, #e91e63, #c2185b); }
    .kpi-purple .kpi-icon { background: linear-gradient(135deg, #9c27b0, #7b1fa2); }
    .kpi-blue .kpi-icon { background: linear-gradient(135deg, #2196f3, #1565c0); }
    .kpi-orange .kpi-icon { background: linear-gradient(135deg, #ff9800, #e65100); }
    .kpi-green .kpi-icon { background: linear-gradient(135deg, #4caf50, #2e7d32); }

    .kpi-info { display: flex; flex-direction: column; }
    .kpi-value { font-size: 1.6rem; font-weight: 700; color: #333; }
    .kpi-label { font-size: 0.8rem; color: #888; font-weight: 500; }

    /* Scent Cards */
    .scent-cards-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }

    .scent-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 16px;
      border-left: 4px solid #ccc;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }

    .scent-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .scent-emoji { font-size: 1.4rem; }
    .scent-name { font-weight: 600; font-size: 1.1rem; color: #333; }

    .scent-card-stats { display: flex; gap: 16px; }
    .scs-item { display: flex; flex-direction: column; }
    .scs-val { font-weight: 700; font-size: 1rem; color: #333; }
    .scs-lbl { font-size: 0.7rem; color: #999; text-transform: uppercase; }

    /* Bar Chart */
    .chart-section {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }

    .chart-section h3 {
      margin: 0 0 20px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #333;
    }

    .bar-chart {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      height: 200px;
      padding: 0 8px;
    }

    .bar-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      height: 100%;
      justify-content: flex-end;
    }

    .bar-value {
      font-size: 0.7rem;
      font-weight: 600;
      color: #555;
    }

    .bar {
      width: 100%;
      max-width: 60px;
      border-radius: 6px 6px 0 0;
      transition: height 0.5s ease;
      min-height: 4px;
    }

    .bar-label {
      font-size: 0.65rem;
      color: #777;
      text-align: center;
      line-height: 1.3;
      margin-top: 4px;
    }

    /* Schedule Table */
    .schedule-section {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }

    .schedule-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .schedule-header h3 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #333;
    }

    .schedule-filters {
      display: flex;
      gap: 12px;
    }

    .filter-field {
      width: 160px;
    }

    .filter-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .schedule-table-wrapper {
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid #e0e0e0;
    }

    .schedule-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
      min-width: 900px;
    }

    .schedule-table thead th {
      background: #2c3e50;
      color: white;
      padding: 8px 6px;
      text-align: center;
      font-weight: 600;
      font-size: 0.75rem;
      position: sticky;
      top: 0;
      z-index: 2;
      white-space: nowrap;
    }

    .schedule-table thead th.weekend {
      background: #34495e;
    }

    .col-scent { min-width: 80px; text-align: left !important; padding-left: 12px !important; }
    .col-type { min-width: 60px; }
    .col-batch { min-width: 90px; text-align: left !important; }
    .col-uom { min-width: 55px; }
    .col-day { min-width: 55px; text-align: center; }
    .col-total { min-width: 65px; text-align: center; background: rgba(0, 0, 0, 0.02); }

    .date-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1.2;
    }

    .day-name { font-size: 0.65rem; opacity: 0.8; }
    .day-num { font-size: 0.9rem; font-weight: 700; }
    .day-month { font-size: 0.6rem; opacity: 0.7; }

    /* Group header */
    .group-header-row td {
      padding: 8px 12px;
      font-size: 0.85rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .group-header-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .group-emoji { font-size: 1.1rem; }

    .group-type-badge {
      padding: 2px 10px;
      border-radius: 10px;
      color: white;
      font-size: 0.7rem;
      font-weight: 600;
    }

    .group-count {
      margin-left: auto;
      font-size: 0.75rem;
      color: #888;
    }

    /* Batch rows */
    .batch-row td {
      padding: 5px 6px;
      border-bottom: 1px solid #f0f0f0;
      text-align: center;
    }

    .batch-row.even-row { background: #fafafa; }

    .batch-row code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      color: #555;
    }

    .zero-qty {
      color: #ccc;
    }

    .has-note {
      color: #e65100;
      cursor: help;
      text-decoration: underline dotted #e65100;
    }

    .type-badge {
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 0.7rem;
      font-weight: 600;
      color: white;
    }

    .type-female { background: #e91e63; }
    .type-male { background: #2196f3; }

    /* Subtotal row */
    .subtotal-row td {
      padding: 6px 6px;
      font-weight: 600;
      font-size: 0.78rem;
      border-bottom: 2px solid #ddd;
      text-align: center;
    }

    .subtotal-label {
      text-align: right !important;
      padding-right: 12px !important;
      color: #555;
      font-style: italic;
    }

    .subtotal-val {
      color: #333;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .dashboard-container { padding: 0 12px 24px; }
      .back-row { flex-direction: column; align-items: flex-start; }
      .dashboard-title { font-size: 1.3rem; }
      .kpi-row { grid-template-columns: repeat(2, 1fr); }
      .scent-cards-row { grid-template-columns: 1fr 1fr; }
      .schedule-filters { flex-direction: column; }
      .filter-field { width: 100%; }
    }
  `]
})
export class CondomsDashboardComponent implements OnInit {
  @Output() goBack = new EventEmitter<void>();

  loading = true;
  error = '';

  dashboard: DashboardData | null = null;
  scheduleGroups: ScentGroup[] = [];
  filteredGroups: ScentGroup[] = [];
  scheduleDates: string[] = [];
  scheduleSummary: ScheduleSummary | null = null;
  allScents: string[] = [];

  filterScent = 'all';
  filterType = 'all';

  private maxDailyTotal = 0;

  ngOnInit(): void {
    this.loadData();
  }

  constructor(private http: HttpClient) {}

  loadData(): void {
    this.loading = true;
    this.error = '';

    // Load dashboard + schedule in parallel
    this.http.get<DashboardData>(`${environment.apiUrl}/condomproject/dashboard`).subscribe({
      next: (data) => {
        this.dashboard = data;
        if (data.dailyTotals) {
          this.maxDailyTotal = Math.max(...data.dailyTotals.map(d => d.total), 1);
        }
      },
      error: (err) => {
        this.error = 'Could not load dashboard data';
        this.loading = false;
      }
    });

    this.http.get<{ dates: string[]; groups: ScentGroup[]; summary: ScheduleSummary }>(
      `${environment.apiUrl}/condomproject/production-schedule`
    ).subscribe({
      next: (data) => {
        this.scheduleDates = data.dates;
        this.scheduleGroups = data.groups;
        this.filteredGroups = [...data.groups];
        this.scheduleSummary = data.summary;
        this.allScents = [...new Set(data.groups.map(g => g.scent))];
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Could not load production schedule';
        this.loading = false;
      }
    });
  }

  applyFilter(): void {
    this.filteredGroups = this.scheduleGroups.filter(g => {
      const scentMatch = this.filterScent === 'all' || g.scent === this.filterScent;
      const typeMatch = this.filterType === 'all' || g.type === this.filterType;
      return scentMatch && typeMatch;
    });
  }

  getScentColor(scent: string): string {
    const colors: Record<string, string> = {
      'Vanilla': '#f9a825',
      'Strawberry': '#e91e63',
      'Banana': '#ffc107',
      'Grape': '#7b1fa2'
    };
    return colors[scent] || '#607d8b';
  }

  getScentEmoji(scent: string): string {
    const emojis: Record<string, string> = {
      'Vanilla': '🍦',
      'Strawberry': '🍓',
      'Banana': '🍌',
      'Grape': '🍇'
    };
    return emojis[scent] || '📦';
  }

  getBarHeight(total: number): number {
    if (this.maxDailyTotal === 0) return 0;
    return (total / this.maxDailyTotal) * 85;
  }

  getBarColor(date: string): string {
    const d = new Date(date);
    const day = d.getDay();
    if (day === 0 || day === 6) return '#90a4ae';
    const week = d.getDate() <= 7 ? 0 : 1;
    return week === 0 ? 'linear-gradient(180deg, #e91e63, #c2185b)' : 'linear-gradient(180deg, #2196f3, #1565c0)';
  }

  isWeekend(date: string): boolean {
    const d = new Date(date);
    return d.getDay() === 0 || d.getDay() === 6;
  }

  getBatchTotal(batch: BatchRow): number {
    return batch.dailyQuantities.reduce((sum, dq) => sum + dq.quantity, 0);
  }

  getGroupDayTotal(group: ScentGroup, date: string): number {
    return group.batches.reduce((sum, b) => {
      const dq = b.dailyQuantities.find(q => q.date === date);
      return sum + (dq?.quantity || 0);
    }, 0);
  }

  getGroupTotal(group: ScentGroup): number {
    return group.batches.reduce((sum, b) => sum + this.getBatchTotal(b), 0);
  }
}
