import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
    MatProgressBarModule,
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
          <div class="title-icon-wrap">
            <mat-icon>health_and_safety</mat-icon>
          </div>
          Condoms Stock Schedule
        </h2>
        <div class="title-actions">
          <button mat-raised-button class="capture-btn" (click)="openCaptureDialog()">
            <mat-icon>add_circle</mat-icon>
            Capture Stock
          </button>
          <div class="date-pill">
            <mat-icon>date_range</mat-icon>
            March 2026
          </div>
        </div>
      </div>

      @if (loading) {
        <div class="loading-state">
          <div class="loading-card">
            <div class="lc-icon-wrap">
              <mat-icon class="lc-icon pulse-icon">health_and_safety</mat-icon>
            </div>
            <h3>Loading Stock Schedule</h3>
            <p class="lc-subtitle">Fetching batch data and daily quantities</p>
            <div class="lc-progress-wrap">
              <div class="lc-progress-track">
                <div class="lc-progress-fill" [style.width.%]="loadingProgress"></div>
              </div>
              <div class="lc-progress-info">
                <span class="lc-progress-message">{{ loadingMessage }}</span>
                <span class="lc-progress-pct">{{ loadingProgress | number:'1.0-0' }}%</span>
              </div>
            </div>
            <div class="lc-steps">
              @for (step of loadingSteps; track step.label; let i = $index) {
                <div class="lc-step" [class.active]="loadingStage === i" [class.done]="loadingStage > i">
                  <div class="lc-step-dot">
                    @if (loadingStage > i) {
                      <mat-icon>check</mat-icon>
                    } @else {
                      <mat-icon>{{ step.icon }}</mat-icon>
                    }
                  </div>
                  <span class="lc-step-label">{{ step.label }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      } @else if (error) {
        <div class="error-container">
          <div class="error-icon-wrap"><mat-icon>error_outline</mat-icon></div>
          <h3>Failed to load stock data</h3>
          <p>{{ error }}</p>
          <button mat-flat-button color="primary" (click)="loadData()">
            <mat-icon>refresh</mat-icon> Retry
          </button>
        </div>
      } @else {
        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card kpi-pink clickable" (click)="openKpiDialog('batches')">
            <div class="kpi-icon-wrap"><mat-icon>inventory_2</mat-icon></div>
            <div class="kpi-body">
              <span class="kpi-number">{{ dashboard?.summary?.totalBatches || 0 }}</span>
              <span class="kpi-label">Total Batches</span>
            </div>
            <div class="kpi-accent"></div>
          </div>
          <div class="kpi-card kpi-purple clickable" (click)="openKpiDialog('female')">
            <div class="kpi-icon-wrap"><mat-icon>female</mat-icon></div>
            <div class="kpi-body">
              <span class="kpi-number">{{ scheduleSummary?.femaleBatches || 0 }}</span>
              <span class="kpi-label">Female Batches</span>
            </div>
            <div class="kpi-accent"></div>
          </div>
          <div class="kpi-card kpi-blue clickable" (click)="openKpiDialog('male')">
            <div class="kpi-icon-wrap"><mat-icon>male</mat-icon></div>
            <div class="kpi-body">
              <span class="kpi-number">{{ scheduleSummary?.maleBatches || 0 }}</span>
              <span class="kpi-label">Male Batches</span>
            </div>
            <div class="kpi-accent"></div>
          </div>
          <div class="kpi-card kpi-orange clickable" (click)="openKpiDialog('scents')">
            <div class="kpi-icon-wrap"><mat-icon>palette</mat-icon></div>
            <div class="kpi-body">
              <span class="kpi-number">{{ dashboard?.summary?.totalScents || 0 }}</span>
              <span class="kpi-label">Scent Variants</span>
            </div>
            <div class="kpi-accent"></div>
          </div>
          <div class="kpi-card kpi-green">
            <div class="kpi-icon-wrap"><mat-icon>assessment</mat-icon></div>
            <div class="kpi-body">
              <span class="kpi-number">{{ (dashboard?.summary?.grandTotal || 0) | number }}</span>
              <span class="kpi-label">Total Units</span>
            </div>
            <div class="kpi-accent"></div>
          </div>
        </div>

        <!-- ==================== KPI DETAIL DIALOGS ==================== -->
        @if (activeDialog) {
          <div class="dialog-backdrop" (click)="closeDialog()"></div>
          <div class="dialog-panel" [class]="'dialog-' + activeDialog">
            <div class="dialog-header" [class]="'dh-' + activeDialog">
              <div class="dialog-title-group">
                <div class="dialog-icon-ring">
                  @switch (activeDialog) {
                    @case ('batches') { <mat-icon>inventory_2</mat-icon> }
                    @case ('female') { <mat-icon>female</mat-icon> }
                    @case ('male') { <mat-icon>male</mat-icon> }
                    @case ('scents') { <mat-icon>palette</mat-icon> }
                  }
                </div>
                <div>
                  <h2 class="dialog-title">
                    @switch (activeDialog) {
                      @case ('batches') { All Stock Batches }
                      @case ('female') { Female Batches }
                      @case ('male') { Male Batches }
                      @case ('scents') { Scent Variants }
                    }
                  </h2>
                  <p class="dialog-subtitle">
                    @switch (activeDialog) {
                      @case ('batches') { Complete batch overview by scent and type }
                      @case ('female') { Female condom stock batches }
                      @case ('male') { Male condom stock batches }
                      @case ('scents') { Stock breakdown by scent variant }
                    }
                  </p>
                </div>
              </div>
              <button class="dialog-close" (click)="closeDialog()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="dialog-body">
              <!-- ── Total Batches Dialog ── -->
              @if (activeDialog === 'batches') {
                <div class="dialog-stats-row">
                  <div class="dialog-stat pink">
                    <span class="ds-val">{{ dashboard?.summary?.totalBatches || 0 }}</span>
                    <span class="ds-lbl">Total Batches</span>
                  </div>
                  <div class="dialog-stat purple">
                    <span class="ds-val">{{ scheduleSummary?.femaleBatches || 0 }}</span>
                    <span class="ds-lbl">Female</span>
                  </div>
                  <div class="dialog-stat blue">
                    <span class="ds-val">{{ scheduleSummary?.maleBatches || 0 }}</span>
                    <span class="ds-lbl">Male</span>
                  </div>
                  <div class="dialog-stat green">
                    <span class="ds-val">{{ (dashboard?.summary?.grandTotal || 0) | number }}</span>
                    <span class="ds-lbl">Total Units</span>
                  </div>
                </div>
                <h4 class="dialog-section-title"><mat-icon>table_chart</mat-icon> Batches by Scent & Type</h4>
                <div class="dialog-table-wrap">
                  <table class="dialog-table">
                    <thead><tr><th>Scent</th><th>Type</th><th class="right">Batches</th><th class="right">Total Units</th><th class="right">Avg/Batch</th></tr></thead>
                    <tbody>
                      @for (group of scheduleGroups; track group.scentGroup) {
                        <tr>
                          <td class="primary-cell">
                            <span class="scent-dot" [style.background]="getScentColor(group.scent)"></span>
                            {{ getScentEmoji(group.scent) }} {{ group.scent }}
                          </td>
                          <td>
                            <span class="type-pill" [class.type-pill-f]="group.type === 'Female'" [class.type-pill-m]="group.type === 'Male'">
                              {{ group.type }}
                            </span>
                          </td>
                          <td class="right mono-text">{{ group.batches.length }}</td>
                          <td class="right mono-text">{{ getGroupTotal(group) | number }}</td>
                          <td class="right mono-text">{{ getGroupAvg(group) | number:'1.0-0' }}</td>
                        </tr>
                      }
                    </tbody>
                    <tfoot>
                      <tr class="total-row">
                        <td colspan="2"><strong>Grand Total</strong></td>
                        <td class="right mono-text"><strong>{{ dashboard?.summary?.totalBatches || 0 }}</strong></td>
                        <td class="right mono-text"><strong>{{ (dashboard?.summary?.grandTotal || 0) | number }}</strong></td>
                        <td class="right mono-text"><strong>—</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              }

              <!-- ── Female Batches Dialog ── -->
              @if (activeDialog === 'female') {
                <div class="dialog-stats-row">
                  <div class="dialog-stat purple">
                    <span class="ds-val">{{ scheduleSummary?.femaleBatches || 0 }}</span>
                    <span class="ds-lbl">Female Batches</span>
                  </div>
                  <div class="dialog-stat pink">
                    <span class="ds-val">{{ getFemaleTotalUnits() | number }}</span>
                    <span class="ds-lbl">Total Units</span>
                  </div>
                  <div class="dialog-stat orange">
                    <span class="ds-val">{{ getFemaleScents().length }}</span>
                    <span class="ds-lbl">Scent Types</span>
                  </div>
                </div>
                <h4 class="dialog-section-title"><mat-icon>bar_chart</mat-icon> Female Batches by Scent</h4>
                <div class="dialog-province-bars">
                  @for (group of getFemaleGroups(); track group.scentGroup) {
                    <div class="bar-row">
                      <span class="bar-row-label">{{ getScentEmoji(group.scent) }} {{ group.scent }}</span>
                      <div class="bar-track">
                        <div class="bar-fill" [style.width.%]="getGroupBarPercent(group, 'Female')" [style.background]="'linear-gradient(90deg, ' + getScentColor(group.scent) + ', ' + getScentColorLight(group.scent) + ')'"></div>
                      </div>
                      <span class="bar-row-value">{{ group.batches.length }} batches</span>
                    </div>
                  }
                </div>
                <h4 class="dialog-section-title" style="margin-top: 20px"><mat-icon>list_alt</mat-icon> Batch Detail</h4>
                <div class="dialog-table-wrap">
                  <table class="dialog-table">
                    <thead><tr><th>Batch Code</th><th>Scent</th><th>UOM</th><th class="right">Total Qty</th></tr></thead>
                    <tbody>
                      @for (group of getFemaleGroups(); track group.scentGroup) {
                        @for (batch of group.batches; track batch.batchCode) {
                          <tr>
                            <td class="primary-cell mono-text">{{ batch.batchCode }}</td>
                            <td>{{ getScentEmoji(group.scent) }} {{ group.scent }}</td>
                            <td>{{ batch.uom }}</td>
                            <td class="right mono-text">{{ getBatchTotal(batch) | number }}</td>
                          </tr>
                        }
                      }
                    </tbody>
                  </table>
                </div>
              }

              <!-- ── Male Batches Dialog ── -->
              @if (activeDialog === 'male') {
                <div class="dialog-stats-row">
                  <div class="dialog-stat blue">
                    <span class="ds-val">{{ scheduleSummary?.maleBatches || 0 }}</span>
                    <span class="ds-lbl">Male Batches</span>
                  </div>
                  <div class="dialog-stat green">
                    <span class="ds-val">{{ getMaleTotalUnits() | number }}</span>
                    <span class="ds-lbl">Total Units</span>
                  </div>
                  <div class="dialog-stat orange">
                    <span class="ds-val">{{ getMaleScents().length }}</span>
                    <span class="ds-lbl">Scent Types</span>
                  </div>
                </div>
                <h4 class="dialog-section-title"><mat-icon>bar_chart</mat-icon> Male Batches by Scent</h4>
                <div class="dialog-province-bars">
                  @for (group of getMaleGroups(); track group.scentGroup) {
                    <div class="bar-row">
                      <span class="bar-row-label">{{ getScentEmoji(group.scent) }} {{ group.scent }}</span>
                      <div class="bar-track">
                        <div class="bar-fill" [style.width.%]="getGroupBarPercent(group, 'Male')" [style.background]="'linear-gradient(90deg, ' + getScentColor(group.scent) + ', ' + getScentColorLight(group.scent) + ')'"></div>
                      </div>
                      <span class="bar-row-value">{{ group.batches.length }} batches</span>
                    </div>
                  }
                </div>
                <h4 class="dialog-section-title" style="margin-top: 20px"><mat-icon>list_alt</mat-icon> Batch Detail</h4>
                <div class="dialog-table-wrap">
                  <table class="dialog-table">
                    <thead><tr><th>Batch Code</th><th>Scent</th><th>UOM</th><th class="right">Total Qty</th></tr></thead>
                    <tbody>
                      @for (group of getMaleGroups(); track group.scentGroup) {
                        @for (batch of group.batches; track batch.batchCode) {
                          <tr>
                            <td class="primary-cell mono-text">{{ batch.batchCode }}</td>
                            <td>{{ getScentEmoji(group.scent) }} {{ group.scent }}</td>
                            <td>{{ batch.uom }}</td>
                            <td class="right mono-text">{{ getBatchTotal(batch) | number }}</td>
                          </tr>
                        }
                      }
                    </tbody>
                  </table>
                </div>
              }

              <!-- ── Scent Variants Dialog ── -->
              @if (activeDialog === 'scents') {
                <div class="dialog-stats-row">
                  <div class="dialog-stat orange">
                    <span class="ds-val">{{ dashboard?.summary?.totalScents || 0 }}</span>
                    <span class="ds-lbl">Scent Variants</span>
                  </div>
                  <div class="dialog-stat pink">
                    <span class="ds-val">{{ dashboard?.summary?.totalBatches || 0 }}</span>
                    <span class="ds-lbl">Total Batches</span>
                  </div>
                  <div class="dialog-stat green">
                    <span class="ds-val">{{ (dashboard?.summary?.grandTotal || 0) | number }}</span>
                    <span class="ds-lbl">Grand Total Units</span>
                  </div>
                </div>
                <h4 class="dialog-section-title"><mat-icon>donut_large</mat-icon> Scent Breakdown</h4>
                <div class="scent-detail-cards">
                  @for (sb of dashboard?.scentBreakdown || []; track sb.scent) {
                    <div class="scent-detail-card" [style.border-left-color]="getScentColor(sb.scent)">
                      <div class="sdc-header">
                        <span class="sdc-emoji">{{ getScentEmoji(sb.scent) }}</span>
                        <div class="sdc-info">
                          <span class="sdc-name">{{ sb.scent }}</span>
                          <span class="sdc-types">{{ sb.types.join(' & ') }}</span>
                        </div>
                        <div class="sdc-badge" [style.background]="getScentColor(sb.scent) + '20'" [style.color]="getScentColor(sb.scent)">
                          {{ sb.batchCount }} batches
                        </div>
                      </div>
                      <div class="sdc-bar-wrapper">
                        <div class="sdc-bar">
                          <div class="sdc-bar-fill" [style.width.%]="getScentPercent(sb.totalUnits)" [style.background]="'linear-gradient(90deg, ' + getScentColor(sb.scent) + ', ' + getScentColorLight(sb.scent) + ')'"></div>
                        </div>
                        <span class="sdc-units">{{ sb.totalUnits | number }} units</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }

        <!-- ==================== CAPTURE STOCK DIALOG ==================== -->
        @if (showCaptureDialog) {
          <div class="dialog-backdrop" (click)="closeCaptureDialog()"></div>
          <div class="dialog-panel dialog-capture">
            <div class="dialog-header dh-capture">
              <div class="dialog-title-group">
                <div class="dialog-icon-ring capture-icon-ring">
                  <mat-icon>add_circle</mat-icon>
                </div>
                <div>
                  <h2 class="dialog-title">Capture New Stock</h2>
                  <p class="dialog-subtitle">Add a new stock entry to the condoms project</p>
                </div>
              </div>
              <button class="dialog-close" (click)="closeCaptureDialog()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="dialog-body">
              @if (captureSuccess) {
                <div class="capture-success">
                  <div class="success-icon-wrap"><mat-icon>check_circle</mat-icon></div>
                  <h3>Stock Entry Created!</h3>
                  <p>{{ captureSuccessMsg }}</p>
                  <div class="success-actions">
                    <button mat-flat-button class="btn-add-another" (click)="resetCaptureForm()">
                      <mat-icon>add</mat-icon> Add Another
                    </button>
                    <button mat-stroked-button (click)="closeCaptureDialog()">
                      <mat-icon>close</mat-icon> Close
                    </button>
                  </div>
                </div>
              } @else {
                @if (captureError) {
                  <div class="capture-error">
                    <mat-icon>error_outline</mat-icon>
                    <span>{{ captureError }}</span>
                  </div>
                }

                <div class="capture-form">
                  <div class="form-row two-col">
                    <div class="form-group">
                      <label class="form-label">Scent <span class="required">*</span></label>
                      <select class="form-select" [(ngModel)]="captureForm.scent">
                        <option value="">Select Scent</option>
                        <option value="Vanilla">🍦 Vanilla</option>
                        <option value="Strawberry">🍓 Strawberry</option>
                        <option value="Banana">🍌 Banana</option>
                        <option value="Grape">🍇 Grape</option>
                        <option value="Plain">📦 Plain</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Type <span class="required">*</span></label>
                      <select class="form-select" [(ngModel)]="captureForm.type">
                        <option value="">Select Type</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-row two-col">
                    <div class="form-group">
                      <label class="form-label">Batch Code <span class="required">*</span></label>
                      <input type="text" class="form-input" [(ngModel)]="captureForm.batchCode" placeholder="e.g. F1K 2501">
                    </div>
                    <div class="form-group">
                      <label class="form-label">UOM</label>
                      <select class="form-select" [(ngModel)]="captureForm.uom">
                        <option value="CASES">CASES</option>
                        <option value="BOXES">BOXES</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-row two-col">
                    <div class="form-group">
                      <label class="form-label">Schedule Date <span class="required">*</span></label>
                      <input type="date" class="form-input" [(ngModel)]="captureForm.scheduleDate">
                    </div>
                    <div class="form-group">
                      <label class="form-label">Quantity <span class="required">*</span></label>
                      <input type="number" class="form-input" [(ngModel)]="captureForm.quantity" placeholder="0" min="1">
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label">Note <span class="optional">(optional)</span></label>
                      <input type="text" class="form-input" [(ngModel)]="captureForm.quantityNote" placeholder="e.g. 24+20 BOX">
                    </div>
                  </div>

                  <div class="form-preview" *ngIf="captureForm.scent && captureForm.type && captureForm.batchCode && captureForm.quantity">
                    <mat-icon>preview</mat-icon>
                    <span>
                      {{ getScentEmoji(captureForm.scent) }} <strong>{{ captureForm.batchCode }}</strong> —
                      {{ captureForm.scent }} {{ captureForm.type }} —
                      {{ captureForm.quantity }} {{ captureForm.uom }}
                      @if (captureForm.scheduleDate) { on {{ captureForm.scheduleDate }} }
                    </span>
                  </div>

                  <div class="form-actions">
                    <button mat-stroked-button (click)="closeCaptureDialog()" [disabled]="captureSaving">Cancel</button>
                    <button mat-flat-button class="btn-submit" (click)="submitStock()" [disabled]="captureSaving || !isCaptureFormValid()">
                      @if (captureSaving) {
                        <mat-spinner diameter="18" strokeWidth="2"></mat-spinner>
                        Saving...
                      } @else {
                        <mat-icon>save</mat-icon>
                        Save Stock Entry
                      }
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }

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
            <div class="section-header">
              <h3><mat-icon>bar_chart</mat-icon> Daily Stock Totals</h3>
              <div class="chart-legend">
                <span class="legend-dot week1"></span> Week 1
                <span class="legend-dot week2"></span> Week 2
              </div>
            </div>
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

        <!-- Stock Schedule Grid -->
        <div class="schedule-section">
          <div class="schedule-header">
            <h3><mat-icon>table_chart</mat-icon> Stock Schedule Detail</h3>
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
    :host {
      --surface: #ffffff;
      --surface-hover: #f8fafc;
      --border: #e2e8f0;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
      --shadow-md: 0 4px 16px rgba(0,0,0,0.08);
      --shadow-lg: 0 8px 32px rgba(0,0,0,0.12);
      --radius: 16px;
      --radius-sm: 12px;
      --pink: #e91e63;
      --pink-soft: #fce4ec;
      --pink-mid: #f8bbd0;
      --pink-light: #f48fb1;
      --purple: #9c27b0;
      --purple-soft: #f3e5f5;
      --purple-mid: #e1bee7;
      --purple-light: #ce93d8;
      --blue: #2196f3;
      --blue-soft: #e3f2fd;
      --blue-mid: #bbdefb;
      --blue-light: #64b5f6;
      --orange: #ff9800;
      --orange-soft: #fff3e0;
      --orange-mid: #ffe0b2;
      --orange-light: #ffb74d;
      --green: #4caf50;
      --green-soft: #e8f5e9;
      --green-mid: #c8e6c9;
      --green-light: #81c784;
    }

    .dashboard-container {
      padding: 0 24px 40px;
    }

    /* ── Back Row ── */
    .back-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }

    .back-btn {
      background: rgba(255, 255, 255, 0.12) !important;
      color: white !important;
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      border-radius: 12px !important;
      transition: all 0.2s !important;
    }
    .back-btn:hover {
      background: rgba(255, 255, 255, 0.22) !important;
    }

    .dashboard-title {
      color: white;
      margin: 0;
      font-size: 1.7rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      letter-spacing: -0.3px;
    }

    .title-icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(8px);
    }
    .title-icon-wrap mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .title-actions {
      display: flex;
      gap: 8px;
    }

    .date-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
      color: white;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .date-pill mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* ── Loading ── */
    .loading-state {
      display: flex; justify-content: center; padding: 60px 20px;
    }
    .loading-card {
      background: var(--surface, #fff); border-radius: 20px;
      padding: 48px 56px; text-align: center; box-shadow: 0 8px 40px rgba(0,0,0,0.08);
      max-width: 520px; width: 100%;
    }
    .loading-card h3 { color: var(--text-primary, #1a1a2e); margin: 16px 0 6px; font-size: 20px; font-weight: 700; }
    .loading-card p { color: var(--text-secondary, #64748b); margin: 0 0 20px; font-size: 14px; line-height: 1.5; }
    .lc-icon-wrap {
      width: 72px; height: 72px; border-radius: 50%; margin: 0 auto;
      background: linear-gradient(135deg, rgba(236,72,153,0.12), rgba(244,114,182,0.12));
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(236,72,153,0.15);
    }
    .lc-icon { font-size: 36px; width: 36px; height: 36px; color: #ec4899; }
    .pulse-icon { animation: pulseGlow 2s ease-in-out infinite; }
    @keyframes pulseGlow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }
    .lc-subtitle { color: #94a3b8 !important; font-size: 13px !important; }
    .lc-progress-wrap { margin: 8px 0 24px; }
    .lc-progress-track { height: 8px; border-radius: 4px; background: #f1f5f9; overflow: hidden; position: relative; }
    .lc-progress-fill {
      height: 100%; border-radius: 4px;
      background: linear-gradient(90deg, #ec4899, #f472b6, #a855f7);
      background-size: 200% 100%; animation: shimmer 2s ease-in-out infinite;
      transition: width 0.15s ease-out; position: relative;
    }
    .lc-progress-fill::after {
      content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 24px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4)); border-radius: 0 4px 4px 0;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .lc-progress-info { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; }
    .lc-progress-message { color: #64748b; font-weight: 500; }
    .lc-progress-pct { color: #ec4899; font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; }
    .lc-steps { display: flex; justify-content: space-between; gap: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0; }
    .lc-step {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      flex: 1; padding-top: 16px; opacity: 0.35; transition: opacity 0.4s ease, transform 0.3s ease;
    }
    .lc-step.active { opacity: 1; transform: translateY(-2px); }
    .lc-step.done { opacity: 0.65; }
    .lc-step-dot {
      width: 32px; height: 32px; border-radius: 50%; background: #f1f5f9;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.3s ease, box-shadow 0.3s ease;
    }
    .lc-step-dot mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; transition: color 0.3s ease; }
    .lc-step.active .lc-step-dot { background: linear-gradient(135deg, #ec4899, #a855f7); box-shadow: 0 2px 10px rgba(236,72,153,0.3); }
    .lc-step.active .lc-step-dot mat-icon { color: #fff; }
    .lc-step.done .lc-step-dot { background: #dcfce7; }
    .lc-step.done .lc-step-dot mat-icon { color: #16a34a; }
    .lc-step-label { font-size: 11px; font-weight: 600; color: #94a3b8; white-space: nowrap; }
    .lc-step.active .lc-step-label { color: #ec4899; }
    .lc-step.done .lc-step-label { color: #16a34a; }

    .error-container {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 48px;
      text-align: center;
      box-shadow: var(--shadow-lg);
    }
    .error-icon-wrap {
      width: 64px; height: 64px; border-radius: 50%;
      background: #fef2f2; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px;
    }
    .error-icon-wrap mat-icon { font-size: 32px; width: 32px; height: 32px; color: #ef4444; }
    .error-container h3 { color: var(--text-primary); margin: 0 0 8px; }
    .error-container p { color: var(--text-secondary); margin: 0 0 20px; }

    /* ── KPI Cards (Modern) ── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 22px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: var(--shadow-md);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
      border: 1px solid transparent;
    }

    .kpi-card.clickable { cursor: pointer; }

    .kpi-card.clickable:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
    }

    .kpi-card.kpi-pink.clickable:hover { border-color: var(--pink-mid); }
    .kpi-card.kpi-purple.clickable:hover { border-color: var(--purple-mid); }
    .kpi-card.kpi-blue.clickable:hover { border-color: var(--blue-mid); }
    .kpi-card.kpi-orange.clickable:hover { border-color: var(--orange-mid); }

    .kpi-accent {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
    }

    .kpi-pink .kpi-accent { background: linear-gradient(90deg, var(--pink), var(--pink-light)); }
    .kpi-purple .kpi-accent { background: linear-gradient(90deg, var(--purple), var(--purple-light)); }
    .kpi-blue .kpi-accent { background: linear-gradient(90deg, var(--blue), var(--blue-light)); }
    .kpi-orange .kpi-accent { background: linear-gradient(90deg, var(--orange), var(--orange-light)); }
    .kpi-green .kpi-accent { background: linear-gradient(90deg, var(--green), var(--green-light)); }

    .kpi-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .kpi-icon-wrap mat-icon { font-size: 24px; width: 24px; height: 24px; color: white; }

    .kpi-pink .kpi-icon-wrap { background: linear-gradient(135deg, var(--pink), #c2185b); }
    .kpi-purple .kpi-icon-wrap { background: linear-gradient(135deg, var(--purple), #7b1fa2); }
    .kpi-blue .kpi-icon-wrap { background: linear-gradient(135deg, var(--blue), #1565c0); }
    .kpi-orange .kpi-icon-wrap { background: linear-gradient(135deg, var(--orange), #e65100); }
    .kpi-green .kpi-icon-wrap { background: linear-gradient(135deg, var(--green), #2e7d32); }

    .kpi-body { display: flex; flex-direction: column; }
    .kpi-number { font-size: 1.65rem; font-weight: 800; color: var(--text-primary); line-height: 1.2; letter-spacing: -0.5px; }
    .kpi-label { font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px; }

    /* ============================== */
    /*  KPI DIALOG OVERLAY            */
    /* ============================== */
    .dialog-backdrop {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(4px); z-index: 1000;
      animation: fadeIn 0.2s ease;
    }
    .dialog-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 94vw; max-width: 720px; max-height: 85vh;
      background: var(--surface); border-radius: 20px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1);
      z-index: 1001; display: flex; flex-direction: column;
      animation: dialogSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes dialogSlideIn {
      from { opacity: 0; transform: translate(-50%, -45%) scale(0.96); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    .dialog-header {
      padding: 24px 28px 20px; display: flex; align-items: center;
      justify-content: space-between; border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .dh-batches { background: linear-gradient(135deg, var(--pink-soft), var(--pink-mid)); }
    .dh-female { background: linear-gradient(135deg, var(--purple-soft), var(--purple-mid)); }
    .dh-male { background: linear-gradient(135deg, var(--blue-soft), var(--blue-mid)); }
    .dh-scents { background: linear-gradient(135deg, var(--orange-soft), var(--orange-mid)); }

    .dialog-title-group { display: flex; align-items: center; gap: 14px; }
    .dialog-icon-ring {
      width: 46px; height: 46px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .dialog-batches .dialog-icon-ring { background: var(--pink); color: white; }
    .dialog-female .dialog-icon-ring { background: var(--purple); color: white; }
    .dialog-male .dialog-icon-ring { background: var(--blue); color: white; }
    .dialog-scents .dialog-icon-ring { background: var(--orange); color: white; }
    .dialog-icon-ring mat-icon { font-size: 24px; width: 24px; height: 24px; }

    .dialog-title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.2; }
    .dialog-subtitle { font-size: 12px; color: var(--text-secondary); margin: 3px 0 0; }

    .dialog-close {
      width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--border);
      background: var(--surface); display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.15s; color: var(--text-secondary); flex-shrink: 0;
    }
    .dialog-close:hover { background: #fef2f2; color: #ef4444; border-color: #fecaca; }
    .dialog-close mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .dialog-body {
      padding: 24px 28px 28px; overflow-y: auto; flex: 1;
    }

    /* Dialog Stats Row */
    .dialog-stats-row {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px; margin-bottom: 24px;
    }
    .dialog-stat {
      padding: 16px 18px; border-radius: 14px; text-align: center;
      display: flex; flex-direction: column; gap: 4px;
    }
    .dialog-stat.pink { background: var(--pink-soft); }
    .dialog-stat.purple { background: var(--purple-soft); }
    .dialog-stat.blue { background: var(--blue-soft); }
    .dialog-stat.orange { background: var(--orange-soft); }
    .dialog-stat.green { background: var(--green-soft); }
    .ds-val { font-size: 22px; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
    .ds-lbl { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }

    .dialog-section-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 14px; font-weight: 700; color: var(--text-primary);
      margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border);
    }
    .dialog-section-title mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--text-secondary); }

    /* Dialog Table */
    .dialog-table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border); }
    .dialog-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    .dialog-table thead { background: #f8fafc; }
    .dialog-table th {
      padding: 10px 16px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-secondary);
      border-bottom: 1px solid var(--border); white-space: nowrap;
    }
    .dialog-table td {
      padding: 10px 16px; border-bottom: 1px solid #f1f5f9; color: var(--text-primary);
    }
    .dialog-table tbody tr:last-child td { border-bottom: none; }
    .dialog-table tbody tr:hover { background: #f8fafc; }
    .dialog-table .right { text-align: right; }
    .dialog-table .mono-text { font-family: 'SF Mono', 'Cascadia Code', monospace; font-size: 13px; }
    .dialog-table .primary-cell { font-weight: 600; }
    .dialog-table tfoot td { border-top: 2px solid var(--border); background: #f8fafc; }
    .total-row td { font-size: 13px; }

    .scent-dot {
      display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle;
    }

    .type-pill {
      display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
    }
    .type-pill-f { background: var(--pink-soft); color: var(--pink); }
    .type-pill-m { background: var(--blue-soft); color: var(--blue); }

    /* Dialog Bar Chart rows */
    .dialog-province-bars { display: flex; flex-direction: column; gap: 10px; }
    .bar-row { display: flex; align-items: center; gap: 12px; }
    .bar-row-label { width: 120px; font-size: 13px; font-weight: 600; color: var(--text-primary); text-align: right; flex-shrink: 0; }
    .bar-track { flex: 1; height: 26px; background: #f1f5f9; border-radius: 8px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 8px; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); min-width: 4px; }
    .bar-row-value { width: 90px; font-size: 13px; font-weight: 700; color: var(--text-primary); font-family: 'SF Mono', monospace; }

    /* Scent Detail Cards (for scent dialog) */
    .scent-detail-cards { display: flex; flex-direction: column; gap: 12px; }
    .scent-detail-card {
      padding: 16px 20px; border-radius: 14px;
      border: 1px solid var(--border); border-left: 4px solid;
      background: var(--surface); transition: all 0.15s;
    }
    .scent-detail-card:hover { background: var(--surface-hover); box-shadow: var(--shadow-sm); }
    .sdc-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .sdc-emoji { font-size: 1.5rem; }
    .sdc-info { display: flex; flex-direction: column; flex: 1; }
    .sdc-name { font-size: 15px; font-weight: 700; color: var(--text-primary); }
    .sdc-types { font-size: 12px; color: var(--text-secondary); }
    .sdc-badge {
      padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700;
    }
    .sdc-bar-wrapper { display: flex; align-items: center; gap: 12px; }
    .sdc-bar { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
    .sdc-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
    .sdc-units { font-size: 13px; font-weight: 700; color: var(--text-primary); white-space: nowrap; font-family: 'SF Mono', monospace; }

    /* ── Scent Breakdown Cards ── */
    .scent-cards-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }

    .scent-card {
      background: var(--surface);
      border-radius: var(--radius-sm);
      padding: 18px 20px;
      border-left: 4px solid #ccc;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s;
    }
    .scent-card:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }

    .scent-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }

    .scent-emoji { font-size: 1.5rem; }
    .scent-name { font-weight: 700; font-size: 1.05rem; color: var(--text-primary); }

    .scent-card-stats { display: flex; gap: 20px; }
    .scs-item { display: flex; flex-direction: column; }
    .scs-val { font-weight: 800; font-size: 1rem; color: var(--text-primary); }
    .scs-lbl { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }

    /* ── Bar Chart ── */
    .chart-section {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-md);
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .section-header h3 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-primary);
      font-weight: 700;
      font-size: 1rem;
    }
    .section-header h3 mat-icon { color: var(--text-secondary); }

    .chart-legend {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-weight: 600;
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      display: inline-block;
      margin-right: 4px;
    }
    .legend-dot.week1 { background: var(--pink); }
    .legend-dot.week2 { background: var(--blue); }

    .bar-chart {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      height: 220px;
      padding: 0 8px;
    }

    .bar-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      height: 100%;
      justify-content: flex-end;
    }

    .bar-value {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--text-secondary);
      font-family: 'SF Mono', monospace;
    }

    .bar {
      width: 100%;
      max-width: 56px;
      border-radius: 8px 8px 0 0;
      transition: height 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      min-height: 4px;
    }

    .bar-label {
      font-size: 0.65rem;
      color: var(--text-muted);
      text-align: center;
      line-height: 1.3;
      margin-top: 4px;
      font-weight: 500;
    }

    /* ── Schedule Table ── */
    .schedule-section {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 24px;
      box-shadow: var(--shadow-md);
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
      color: var(--text-primary);
      font-weight: 700;
      font-size: 1rem;
    }
    .schedule-header h3 mat-icon { color: var(--text-secondary); }

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
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
    }

    .schedule-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
      min-width: 900px;
    }

    .schedule-table thead th {
      background: #1e293b;
      color: white;
      padding: 10px 6px;
      text-align: center;
      font-weight: 700;
      font-size: 0.72rem;
      position: sticky;
      top: 0;
      z-index: 2;
      white-space: nowrap;
      letter-spacing: 0.2px;
    }

    .schedule-table thead th.weekend {
      background: #334155;
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

    .day-name { font-size: 0.62rem; opacity: 0.7; }
    .day-num { font-size: 0.9rem; font-weight: 800; }
    .day-month { font-size: 0.58rem; opacity: 0.6; }

    /* Group header */
    .group-header-row td {
      padding: 8px 12px;
      font-size: 0.85rem;
      border-bottom: 1px solid var(--border);
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
      color: var(--text-muted);
      font-weight: 600;
    }

    /* Batch rows */
    .batch-row td {
      padding: 5px 6px;
      border-bottom: 1px solid #f1f5f9;
      text-align: center;
    }

    .batch-row.even-row { background: #fafbfc; }
    .batch-row:hover { background: #f1f5f9; }

    .batch-row code {
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-primary);
      font-family: 'SF Mono', 'Cascadia Code', monospace;
    }

    .zero-qty {
      color: #cbd5e1;
    }

    .has-note {
      color: #ea580c;
      cursor: help;
      text-decoration: underline dotted #ea580c;
    }

    .type-badge {
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 0.7rem;
      font-weight: 700;
      color: white;
    }

    .type-female { background: var(--pink); }
    .type-male { background: var(--blue); }

    /* Subtotal row */
    .subtotal-row td {
      padding: 6px 6px;
      font-weight: 700;
      font-size: 0.78rem;
      border-bottom: 2px solid var(--border);
      text-align: center;
    }

    .subtotal-label {
      text-align: right !important;
      padding-right: 12px !important;
      color: var(--text-secondary);
      font-style: italic;
    }

    .subtotal-val {
      color: var(--text-primary);
    }

    /* ── Capture Stock Button ── */
    .capture-btn {
      background: linear-gradient(135deg, #4caf50, #2e7d32) !important;
      color: white !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      border-radius: 12px !important;
      font-weight: 700 !important;
      padding: 6px 18px !important;
      transition: all 0.2s !important;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .capture-btn:hover {
      background: linear-gradient(135deg, #66bb6a, #388e3c) !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4) !important;
    }

    /* ── Capture Dialog Styles ── */
    .dh-capture {
      background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
    }
    .capture-icon-ring {
      background: var(--green) !important;
      color: white !important;
    }

    .capture-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .form-row.two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .form-label .required {
      color: #ef4444;
    }

    .form-label .optional {
      color: var(--text-muted);
      font-weight: 500;
      text-transform: none;
      font-size: 11px;
    }

    .form-input, .form-select {
      padding: 10px 14px;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      font-size: 14px;
      color: var(--text-primary);
      background: var(--surface);
      transition: all 0.15s;
      outline: none;
      font-family: inherit;
    }

    .form-input:focus, .form-select:focus {
      border-color: var(--green);
      box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.12);
    }

    .form-input::placeholder {
      color: var(--text-muted);
    }

    .form-select {
      cursor: pointer;
      appearance: auto;
    }

    .form-preview {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      font-size: 13px;
      color: var(--text-primary);
    }
    .form-preview mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--green);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
    }

    .btn-submit {
      background: linear-gradient(135deg, #4caf50, #2e7d32) !important;
      color: white !important;
      border-radius: 10px !important;
      font-weight: 700 !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 8px 20px !important;
    }
    .btn-submit:disabled {
      opacity: 0.5 !important;
    }

    .capture-success {
      text-align: center;
      padding: 24px 0;
    }

    .success-icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #e8f5e9;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .success-icon-wrap mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #4caf50;
    }

    .capture-success h3 {
      color: var(--text-primary);
      font-weight: 700;
      margin: 0 0 6px;
    }

    .capture-success p {
      color: var(--text-secondary);
      margin: 0 0 20px;
      font-size: 14px;
    }

    .success-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
    }

    .btn-add-another {
      background: var(--green) !important;
      color: white !important;
      border-radius: 10px !important;
      font-weight: 700 !important;
    }

    .capture-error {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      color: #dc2626;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .capture-error mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    /* ── Responsive ── */
    @media (max-width: 1100px) {
      .kpi-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 768px) {
      .dashboard-container { padding: 0 12px 24px; }
      .back-row { flex-direction: column; align-items: flex-start; }
      .dashboard-title { font-size: 1.3rem; }
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .scent-cards-row { grid-template-columns: 1fr 1fr; }
      .schedule-filters { flex-direction: column; }
      .filter-field { width: 100%; }
      .dialog-panel { max-width: 95vw; }
    }
    @media (max-width: 600px) {
      .kpi-grid { grid-template-columns: 1fr 1fr; }
      .dialog-panel { width: 100vw; max-height: 95vh; border-radius: 16px 16px 0 0; }
      .dialog-header { padding: 18px 20px 16px; }
    }
  `]
})
export class CondomsDashboardComponent implements OnInit {
  @Output() goBack = new EventEmitter<void>();

  loading = true;
  error = '';

  // Loading progress
  loadingProgress = 0;
  loadingStage = 0;
  loadingMessage = 'Initializing...';
  private progressInterval: any;
  readonly loadingSteps = [
    { icon: 'lock', label: 'Authenticating', detail: 'Securing connection...' },
    { icon: 'cloud_download', label: 'Fetching Data', detail: 'Loading batch records...' },
    { icon: 'science', label: 'Processing', detail: 'Analyzing schedule data...' },
    { icon: 'dashboard', label: 'Ready', detail: 'Building stock dashboard...' }
  ];

  dashboard: DashboardData | null = null;
  scheduleGroups: ScentGroup[] = [];
  filteredGroups: ScentGroup[] = [];
  scheduleDates: string[] = [];
  scheduleSummary: ScheduleSummary | null = null;
  allScents: string[] = [];

  filterScent = 'all';
  filterType = 'all';

  // Dialog
  activeDialog: string | null = null;

  // Capture Stock
  showCaptureDialog = false;
  captureSaving = false;
  captureError = '';
  captureSuccess = false;
  captureSuccessMsg = '';
  captureForm = {
    scent: '',
    type: '',
    batchCode: '',
    uom: 'CASES',
    scheduleDate: '',
    quantity: 0,
    quantityNote: ''
  };

  private maxDailyTotal = 0;

  ngOnInit(): void {
    this.loadData();
  }

  constructor(private http: HttpClient) {}

  loadData(): void {
    this.loading = true;
    this.error = '';
    this.startLoadingProgress();

    this.http.get<DashboardData>(`${environment.apiUrl}/condomproject/dashboard`).subscribe({
      next: (data) => {
        this.dashboard = data;
        if (data.dailyTotals) {
          this.maxDailyTotal = Math.max(...data.dailyTotals.map(d => d.total), 1);
        }
      },
      error: () => {
        this.error = 'Could not load dashboard data';
        this.stopLoadingProgress();
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
        this.finishLoadingProgress(() => {
          this.loading = false;
        });
      },
      error: () => {
        this.error = 'Could not load stock schedule';
        this.stopLoadingProgress();
        this.loading = false;
      }
    });
  }

  private startLoadingProgress(): void {
    this.loadingProgress = 0;
    this.loadingStage = 0;
    this.loadingMessage = this.loadingSteps[0].detail;
    this.progressInterval = setInterval(() => {
      const max = 88;
      if (this.loadingProgress < max) {
        const increment = Math.max(0.3, (max - this.loadingProgress) * 0.06);
        this.loadingProgress = Math.min(max, this.loadingProgress + increment);
      }
      const newStage = this.loadingProgress < 20 ? 0 : this.loadingProgress < 45 ? 1 : this.loadingProgress < 70 ? 2 : 3;
      if (newStage !== this.loadingStage) {
        this.loadingStage = newStage;
        this.loadingMessage = this.loadingSteps[newStage].detail;
      }
    }, 120);
  }

  private finishLoadingProgress(callback: () => void): void {
    clearInterval(this.progressInterval);
    this.loadingStage = 3;
    this.loadingMessage = 'Almost there...';
    const finish = setInterval(() => {
      this.loadingProgress = Math.min(100, this.loadingProgress + 4);
      if (this.loadingProgress >= 100) {
        clearInterval(finish);
        this.loadingMessage = 'Complete!';
        setTimeout(() => callback(), 300);
      }
    }, 30);
  }

  private stopLoadingProgress(): void {
    clearInterval(this.progressInterval);
    this.loadingProgress = 0;
    this.loadingStage = 0;
  }

  // ── Dialog Methods ──

  openKpiDialog(type: string): void {
    this.activeDialog = type;
  }

  closeDialog(): void {
    this.activeDialog = null;
  }

  // ── Capture Stock Methods ──

  openCaptureDialog(): void {
    this.resetCaptureForm();
    this.showCaptureDialog = true;
  }

  closeCaptureDialog(): void {
    this.showCaptureDialog = false;
    this.captureError = '';
    this.captureSuccess = false;
  }

  resetCaptureForm(): void {
    this.captureForm = {
      scent: '',
      type: '',
      batchCode: '',
      uom: 'CASES',
      scheduleDate: '',
      quantity: 0,
      quantityNote: ''
    };
    this.captureError = '';
    this.captureSuccess = false;
    this.captureSuccessMsg = '';
    this.captureSaving = false;
  }

  isCaptureFormValid(): boolean {
    return !!(
      this.captureForm.scent &&
      this.captureForm.type &&
      this.captureForm.batchCode.trim() &&
      this.captureForm.scheduleDate &&
      this.captureForm.quantity > 0
    );
  }

  submitStock(): void {
    if (!this.isCaptureFormValid()) return;

    this.captureSaving = true;
    this.captureError = '';

    const payload = {
      scent: this.captureForm.scent,
      type: this.captureForm.type,
      batchCode: this.captureForm.batchCode.trim(),
      uom: this.captureForm.uom || 'CASES',
      scheduleDate: this.captureForm.scheduleDate,
      quantity: this.captureForm.quantity,
      quantityNote: this.captureForm.quantityNote?.trim() || null
    };

    this.http.post<{ success: boolean; message: string }>(`${environment.apiUrl}/condomproject/stock`, payload).subscribe({
      next: (res) => {
        this.captureSaving = false;
        this.captureSuccess = true;
        this.captureSuccessMsg = res.message || 'Stock entry created successfully';
        // Refresh data
        this.loadData();
      },
      error: (err) => {
        this.captureSaving = false;
        this.captureError = err.error?.error || err.error?.message || 'Failed to create stock entry. Please try again.';
      }
    });
  }

  // ── Filter ──

  applyFilter(): void {
    this.filteredGroups = this.scheduleGroups.filter(g => {
      const scentMatch = this.filterScent === 'all' || g.scent === this.filterScent;
      const typeMatch = this.filterType === 'all' || g.type === this.filterType;
      return scentMatch && typeMatch;
    });
  }

  // ── Helpers ──

  getScentColor(scent: string): string {
    const colors: Record<string, string> = {
      'Vanilla': '#f9a825',
      'Strawberry': '#e91e63',
      'Banana': '#ffc107',
      'Grape': '#7b1fa2'
    };
    return colors[scent] || '#607d8b';
  }

  getScentColorLight(scent: string): string {
    const colors: Record<string, string> = {
      'Vanilla': '#ffee58',
      'Strawberry': '#f48fb1',
      'Banana': '#ffe082',
      'Grape': '#ce93d8'
    };
    return colors[scent] || '#90a4ae';
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

  getGroupAvg(group: ScentGroup): number {
    if (group.batches.length === 0) return 0;
    return this.getGroupTotal(group) / group.batches.length;
  }

  // ── Dialog Data Helpers ──

  getFemaleGroups(): ScentGroup[] {
    return this.scheduleGroups.filter(g => g.type === 'Female');
  }

  getMaleGroups(): ScentGroup[] {
    return this.scheduleGroups.filter(g => g.type === 'Male');
  }

  getFemaleScents(): string[] {
    return [...new Set(this.getFemaleGroups().map(g => g.scent))];
  }

  getMaleScents(): string[] {
    return [...new Set(this.getMaleGroups().map(g => g.scent))];
  }

  getFemaleTotalUnits(): number {
    return this.getFemaleGroups().reduce((sum, g) => sum + this.getGroupTotal(g), 0);
  }

  getMaleTotalUnits(): number {
    return this.getMaleGroups().reduce((sum, g) => sum + this.getGroupTotal(g), 0);
  }

  getGroupBarPercent(group: ScentGroup, type: string): number {
    const groups = type === 'Female' ? this.getFemaleGroups() : this.getMaleGroups();
    const maxBatches = Math.max(...groups.map(g => g.batches.length), 1);
    return (group.batches.length / maxBatches) * 100;
  }

  getScentPercent(units: number): number {
    const maxUnits = Math.max(...(this.dashboard?.scentBreakdown || []).map(s => s.totalUnits), 1);
    return (units / maxUnits) * 100;
  }
}
