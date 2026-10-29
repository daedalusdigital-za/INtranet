import { Component, OnInit, Output, EventEmitter, ViewChild, ElementRef, NgZone, inject } from '@angular/core';
import { GoogleMapsLoaderService } from '../../../services/google-maps-loader.service';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../../ui/empty-state/empty-state.component';

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
  totalUnits: number;
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
  dailyTotals: { date: string; total: number; femaleTotal: number; maleTotal: number }[];
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
    DecimalPipe,
    SkeletonRowsComponent,
    EmptyStateComponent
  ],
  template: `
    <div class="dashboard-container">
      <!-- Back Button -->
      <div class="back-row">
        <button mat-stroked-button (click)="goBack.emit()" class="back-btn">
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
          <button mat-flat-button color="primary" class="capture-btn" (click)="openCaptureDialog()">
            <mat-icon>add_circle</mat-icon>
            Capture Stock
          </button>
          <button mat-stroked-button class="request-delivery-btn" (click)="showDeliveryPasswordPrompt()">
            <mat-icon>local_shipping</mat-icon>
            Request Delivery
          </button>
          <div class="date-pill">
            <mat-icon>date_range</mat-icon>
            March 2026
          </div>
        </div>
      </div>

      @if (loading) {
        <div class="loading-state">
          <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows>
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
          </div>
          <div class="kpi-card kpi-purple clickable" (click)="openKpiDialog('female')">
            <div class="kpi-icon-wrap"><mat-icon>female</mat-icon></div>
            <div class="kpi-body">
              <span class="kpi-number">{{ scheduleSummary?.femaleBatches || 0 }}</span>
              <span class="kpi-label">Female Batches</span>
            </div>
          </div>
          <div class="kpi-card kpi-blue clickable" (click)="openKpiDialog('male')">
            <div class="kpi-icon-wrap"><mat-icon>male</mat-icon></div>
            <div class="kpi-body">
              <span class="kpi-number">{{ scheduleSummary?.maleBatches || 0 }}</span>
              <span class="kpi-label">Male Batches</span>
            </div>
          </div>
          <div class="kpi-card kpi-orange clickable" (click)="openKpiDialog('scents')">
            <div class="kpi-icon-wrap"><mat-icon>palette</mat-icon></div>
            <div class="kpi-body">
              <span class="kpi-number">{{ dashboard?.summary?.totalScents || 0 }}</span>
              <span class="kpi-label">Scent Variants</span>
            </div>
          </div>
          <div class="kpi-card kpi-green">
            <div class="kpi-icon-wrap"><mat-icon>assessment</mat-icon></div>
            <div class="kpi-body">
              <span class="kpi-number">{{ (dashboard?.summary?.grandTotal || 0) | number }}</span>
              <span class="kpi-label">Total Units</span>
            </div>
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
              <button aria-label="Close" class="dialog-close" (click)="closeDialog()">
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
                  <table class="app-table">
                    <thead><tr><th>Scent</th><th>Type</th><th class="num">Batches</th><th class="num">Total Units</th><th class="num">Avg/Batch</th></tr></thead>
                    <tbody>
                      @for (group of scheduleGroups; track group.scentGroup) {
                        <tr>
                          <td class="primary-cell">
                            <span class="scent-dot" [style.background]="getScentColor(group.scent)"></span>
                            {{ group.scent }}
                          </td>
                          <td>
                            <span class="type-pill" [class.type-pill-f]="group.type === 'Female'" [class.type-pill-m]="group.type === 'Male'">
                              {{ group.type }}
                            </span>
                          </td>
                          <td class="num">{{ group.batches.length }}</td>
                          <td class="num">{{ getGroupTotal(group) | number }}</td>
                          <td class="num">{{ getGroupAvg(group) | number:'1.0-0' }}</td>
                        </tr>
                      }
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colspan="2">Grand Total</td>
                        <td class="num">{{ dashboard?.summary?.totalBatches || 0 }}</td>
                        <td class="num">{{ (dashboard?.summary?.grandTotal || 0) | number }}</td>
                        <td class="num">—</td>
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
                      <span class="bar-row-label">{{ group.scent }}</span>
                      <div class="bar-track">
                        <div class="bar-fill" [style.width.%]="getGroupBarPercent(group, 'Female')" [style.background]="getScentColor(group.scent)"></div>
                      </div>
                      <span class="bar-row-value">{{ group.batches.length }} batches</span>
                    </div>
                  }
                </div>
                <h4 class="dialog-section-title spaced"><mat-icon>list_alt</mat-icon> Batch Detail</h4>
                <div class="dialog-table-wrap">
                  <table class="app-table">
                    <thead><tr><th>Batch Code</th><th>Scent</th><th>UOM</th><th class="num">Total Qty</th></tr></thead>
                    <tbody>
                      @for (group of getFemaleGroups(); track group.scentGroup) {
                        @for (batch of group.batches; track batch.batchCode) {
                          <tr>
                            <td class="primary-cell ref">{{ batch.batchCode }}</td>
                            <td><span class="scent-dot" [style.background]="getScentColor(group.scent)"></span>{{ group.scent }}</td>
                            <td>{{ batch.uom }}</td>
                            <td class="num">{{ getBatchTotal(batch) | number }}</td>
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
                      <span class="bar-row-label">{{ group.scent }}</span>
                      <div class="bar-track">
                        <div class="bar-fill" [style.width.%]="getGroupBarPercent(group, 'Male')" [style.background]="getScentColor(group.scent)"></div>
                      </div>
                      <span class="bar-row-value">{{ group.batches.length }} batches</span>
                    </div>
                  }
                </div>
                <h4 class="dialog-section-title spaced"><mat-icon>list_alt</mat-icon> Batch Detail</h4>
                <div class="dialog-table-wrap">
                  <table class="app-table">
                    <thead><tr><th>Batch Code</th><th>Scent</th><th>UOM</th><th class="num">Total Qty</th></tr></thead>
                    <tbody>
                      @for (group of getMaleGroups(); track group.scentGroup) {
                        @for (batch of group.batches; track batch.batchCode) {
                          <tr>
                            <td class="primary-cell ref">{{ batch.batchCode }}</td>
                            <td><span class="scent-dot" [style.background]="getScentColor(group.scent)"></span>{{ group.scent }}</td>
                            <td>{{ batch.uom }}</td>
                            <td class="num">{{ getBatchTotal(batch) | number }}</td>
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
                        <div class="sdc-info">
                          <span class="sdc-name">{{ sb.scent }}</span>
                          <span class="sdc-types">{{ sb.types.join(' & ') }}</span>
                        </div>
                        <div class="sdc-badge" [style.background]="getScentSoft(sb.scent)" [style.color]="getScentColor(sb.scent)">
                          {{ sb.batchCount }} batches
                        </div>
                      </div>
                      <div class="sdc-bar-wrapper">
                        <div class="sdc-bar">
                          <div class="sdc-bar-fill" [style.width.%]="getScentPercent(sb.totalUnits)" [style.background]="getScentColor(sb.scent)"></div>
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
              <button aria-label="Close" class="dialog-close" (click)="closeCaptureDialog()">
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
                    <button mat-flat-button color="primary" (click)="resetCaptureForm()">
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
                        <option value="Vanilla">Vanilla</option>
                        <option value="Strawberry">Strawberry</option>
                        <option value="Banana">Banana</option>
                        <option value="Grape">Grape</option>
                        <option value="Plain">Plain</option>
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
                      <strong>{{ captureForm.batchCode }}</strong> —
                      {{ captureForm.scent }} {{ captureForm.type }} —
                      {{ captureForm.quantity }} {{ captureForm.uom }}
                      @if (captureForm.scheduleDate) { on {{ captureForm.scheduleDate }} }
                    </span>
                  </div>

                  <div class="form-actions">
                    <button mat-stroked-button (click)="closeCaptureDialog()" [disabled]="captureSaving">Cancel</button>
                    <button mat-flat-button color="primary" class="btn-submit" (click)="submitStock()" [disabled]="captureSaving || !isCaptureFormValid()">
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

        <!-- ==================== DELIVERY PASSWORD DIALOG ==================== -->
        @if (showDeliveryPasswordDialog) {
          <div class="dialog-backdrop" (click)="cancelDeliveryPassword()"></div>
          <div class="pwd-dialog">
            <mat-icon class="pwd-lock-icon">lock</mat-icon>
            <h3>Password Required</h3>
            <p>Enter the delivery request password to continue</p>
            @if (deliveryPasswordError) {
              <div class="pwd-error">{{ deliveryPasswordError }}</div>
            }
            <mat-form-field appearance="outline" class="pwd-input">
              <mat-label>Password</mat-label>
              <input matInput type="password" [(ngModel)]="deliveryPasswordInput"
                     (keydown.enter)="verifyDeliveryPassword()"
                     placeholder="Enter password" autofocus>
            </mat-form-field>
            <div class="pwd-actions">
              <button mat-stroked-button (click)="cancelDeliveryPassword()">Cancel</button>
              <button mat-flat-button color="primary" (click)="verifyDeliveryPassword()">
                <mat-icon>lock_open</mat-icon> Verify
              </button>
            </div>
          </div>
        }

        <!-- ==================== REQUEST DELIVERY DIALOG ==================== -->
        @if (showDeliveryDialog) {
          <div class="dialog-backdrop" (click)="closeDeliveryDialog()"></div>
          <div class="dialog-panel dialog-delivery">
            <div class="dialog-header dh-delivery">
              <div class="dialog-title-group">
                <div class="dialog-icon-ring delivery-icon-ring">
                  <mat-icon>local_shipping</mat-icon>
                </div>
                <div>
                  <h2 class="dialog-title">Request Delivery</h2>
                  <p class="dialog-subtitle">Submit a delivery request to logistics</p>
                </div>
              </div>
              <button aria-label="Close" class="dialog-close" (click)="closeDeliveryDialog()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="dialog-body">
              @if (deliverySuccess) {
                <div class="capture-success">
                  <div class="success-icon-wrap"><mat-icon>check_circle</mat-icon></div>
                  <h3>Delivery Request Submitted!</h3>
                  <p>{{ deliverySuccessMsg }}</p>
                  <div class="success-actions">
                    <button mat-flat-button color="primary" (click)="resetDeliveryForm()">
                      <mat-icon>add</mat-icon> Request Another
                    </button>
                    <button mat-stroked-button (click)="closeDeliveryDialog()">
                      <mat-icon>close</mat-icon> Close
                    </button>
                  </div>
                </div>
              } @else {
                @if (deliveryError) {
                  <div class="capture-error">
                    <mat-icon>error_outline</mat-icon>
                    <span>{{ deliveryError }}</span>
                  </div>
                }

                <div class="capture-form">
                  <div class="form-row two-col">
                    <div class="form-group">
                      <label class="form-label">Invoice Number <span class="optional">(optional)</span></label>
                      <input type="text" class="form-input" [(ngModel)]="deliveryForm.invoiceNumber" placeholder="e.g. INV-001234">
                    </div>
                    <div class="form-group">
                      <label class="form-label">Priority</label>
                      <select class="form-select" [(ngModel)]="deliveryForm.priority">
                        <option value="Normal">Normal</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-row two-col">
                    <div class="form-group">
                      <label class="form-label">Scent <span class="optional">(optional)</span></label>
                      <select class="form-select" [(ngModel)]="deliveryForm.scent">
                        <option value="">Any Scent</option>
                        <option value="Vanilla">Vanilla</option>
                        <option value="Strawberry">Strawberry</option>
                        <option value="Banana">Banana</option>
                        <option value="Grape">Grape</option>
                        <option value="Plain">Plain</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Type <span class="optional">(optional)</span></label>
                      <select class="form-select" [(ngModel)]="deliveryForm.type">
                        <option value="">Any Type</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-row two-col">
                    <div class="form-group">
                      <label class="form-label">Quantity <span class="required">*</span></label>
                      <input type="number" class="form-input" [(ngModel)]="deliveryForm.quantity" placeholder="0" min="1">
                    </div>
                    <div class="form-group">
                      <label class="form-label">UOM</label>
                      <select class="form-select" [(ngModel)]="deliveryForm.unitOfMeasure">
                        <option value="CASES">CASES</option>
                        <option value="BOXES">BOXES</option>
                        <option value="UNITS">UNITS</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label">Description <span class="required">*</span></label>
                      <input type="text" class="form-input" [(ngModel)]="deliveryForm.description" placeholder="e.g. Deliver 50 cases of Vanilla Female condoms to warehouse">
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label">Delivery Address <span class="optional">(optional)</span></label>
                      <div class="address-input-wrap">
                        <mat-icon class="address-loc-icon">location_on</mat-icon>
                        <input #deliveryAddressInput type="text" class="form-input address-input"
                               [(ngModel)]="deliveryForm.deliveryAddress"
                               placeholder="Start typing an address..." autocomplete="off">
                        @if (addressVerified) {
                          <mat-icon class="address-verified">verified</mat-icon>
                        }
                      </div>
                      @if (addressVerified) {
                        <span class="address-confirmed-text">Address verified via Google</span>
                      }
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label">Notes <span class="optional">(optional)</span></label>
                      <input type="text" class="form-input" [(ngModel)]="deliveryForm.notes" placeholder="Any additional instructions...">
                    </div>
                  </div>

                  <div class="form-preview" *ngIf="deliveryForm.description && deliveryForm.quantity > 0">
                    <mat-icon>local_shipping</mat-icon>
                    <span>
                      @if (deliveryForm.priority === 'Urgent') { <strong class="urgent-tag">Urgent:</strong> }
                      <strong>{{ deliveryForm.quantity }} {{ deliveryForm.unitOfMeasure }}</strong> —
                      {{ deliveryForm.description }}
                      @if (deliveryForm.invoiceNumber) { ({{ deliveryForm.invoiceNumber }}) }
                    </span>
                  </div>

                  <div class="form-actions">
                    <button mat-stroked-button (click)="closeDeliveryDialog()" [disabled]="deliverySaving">Cancel</button>
                    <button mat-flat-button color="primary" class="btn-submit" (click)="submitDeliveryRequest()" [disabled]="deliverySaving || !isDeliveryFormValid()">
                      @if (deliverySaving) {
                        <mat-spinner diameter="18" strokeWidth="2"></mat-spinner>
                        Submitting...
                      } @else {
                        <mat-icon>send</mat-icon>
                        Submit Request
                      }
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Scent Breakdown Pod -->
        <div class="scent-pod">
          <div class="scent-pod-header">
            <h3 class="scent-pod-title"><mat-icon>palette</mat-icon> Scent Breakdown</h3>
            <div class="scent-pod-view-toggle">
              <button aria-label="List view" class="view-toggle-btn" [class.active]="scentPodView === 'list'" (click)="scentPodView = 'list'" matTooltip="List view">
                <mat-icon>view_list</mat-icon>
              </button>
              <button aria-label="Grid view" class="view-toggle-btn" [class.active]="scentPodView === 'grid'" (click)="scentPodView = 'grid'" matTooltip="Grid view">
                <mat-icon>grid_view</mat-icon>
              </button>
            </div>
          </div>

          @if (scentPodView === 'grid') {
            <div class="scent-cards-row">
              @for (sb of dashboard?.scentBreakdown || []; track sb.scent) {
                <div class="scent-card" [style.border-left-color]="getScentColor(sb.scent)">
                  <div class="scent-card-header">
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
          } @else {
            <div class="scent-list">
              @for (sb of dashboard?.scentBreakdown || []; track sb.scent) {
                <div class="scent-list-item" [style.border-left-color]="getScentColor(sb.scent)">
                  <div class="scent-list-left">
                    <span class="scent-name">{{ sb.scent }}</span>
                  </div>
                  <div class="scent-list-stats">
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
          }
        </div>

        <!-- Daily Total Bar Chart -->
        @if (dashboard?.dailyTotals && dashboard!.dailyTotals.length > 0) {
          <div class="chart-section">
            <div class="section-header">
              <h3><mat-icon>bar_chart</mat-icon> Daily Stock Totals</h3>
              <div class="chart-legend">
                <span class="legend-dot female"></span> Female
                <span class="legend-dot male"></span> Male
              </div>
            </div>
            <div class="bar-chart">
              @for (dt of dashboard!.dailyTotals; track dt.date) {
                <div class="bar-col">
                  <span class="bar-value">{{ dt.total | number }}</span>
                  <div class="stacked-bar" [style.height.%]="getBarHeight(dt.total)">
                    <div class="bar-segment female" [style.flex]="dt.femaleTotal" matTooltip="Female: {{ dt.femaleTotal | number }}"></div>
                    <div class="bar-segment male" [style.flex]="dt.maleTotal" matTooltip="Male: {{ dt.maleTotal | number }}"></div>
                  </div>
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
              <button class="collapse-all-btn" (click)="toggleAllGroups()" matTooltip="{{ collapsedGroups.size === filteredGroups.length ? 'Expand' : 'Collapse' }} all scent groups">
                <mat-icon>{{ collapsedGroups.size === filteredGroups.length ? 'unfold_more' : 'unfold_less' }}</mat-icon>
                {{ collapsedGroups.size === filteredGroups.length ? 'Expand All' : 'Collapse All' }}
              </button>
              <mat-form-field appearance="outline" class="filter-field">
                <mat-label>Filter by Scent</mat-label>
                <mat-select [(value)]="filterScent" (selectionChange)="applyFilter()">
                  <mat-option value="all">All Scents</mat-option>
                  @for (s of allScents; track s) {
                    <mat-option [value]="s">{{ s }}</mat-option>
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
            <table class="app-table schedule-table">
              <thead>
                <tr>
                  <th class="col-scent">Scent</th>
                  <th class="col-type">Type</th>
                  <th class="col-batch">Batch</th>
                  <th class="col-uom">UOM</th>
                  @for (d of scheduleDates; track d) {
                    <th class="col-day num" [class.weekend]="isWeekend(d)">
                      <div class="date-header">
                        <span class="day-name">{{ d | date:'EEE' }}</span>
                        <span class="day-num">{{ d | date:'dd' }}</span>
                        <span class="day-month">{{ d | date:'MMM' }}</span>
                      </div>
                    </th>
                  }
                  <th class="col-total num">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (group of filteredGroups; track group.scentGroup) {
                  <!-- Scent group header -->
                  <tr class="group-header-row" [style.background]="getScentSoft(group.scent)" (click)="toggleGroupCollapse(group.scentGroup)">
                    <td [attr.colspan]="4 + scheduleDates.length + 1" class="group-header-cell">
                      <mat-icon class="group-chevron" [class.chevron-collapsed]="collapsedGroups.has(group.scentGroup)">expand_more</mat-icon>
                      <span class="scent-dot" [style.background]="getScentColor(group.scent)"></span>
                      <strong>{{ group.scent }}</strong>
                      <span class="type-pill" [class.type-pill-f]="group.type === 'Female'" [class.type-pill-m]="group.type === 'Male'">
                        {{ group.type }}
                      </span>
                      <span class="group-count">{{ group.batches.length }} batches &bull; {{ getGroupTotal(group) | number }} units</span>
                    </td>
                  </tr>
                  @if (!collapsedGroups.has(group.scentGroup)) {
                    @for (batch of group.batches; track batch.batchCode; let i = $index) {
                      <tr class="batch-row">
                        <td class="col-scent">
                          @if (i === 0) {
                            {{ group.scent }}
                          }
                        </td>
                        <td class="col-type">
                          @if (i === 0) {
                            <span class="type-pill" [class.type-pill-f]="group.type === 'Female'" [class.type-pill-m]="group.type === 'Male'">
                              {{ group.type }}
                            </span>
                          }
                        </td>
                        <td class="col-batch ref">{{ batch.batchCode }}</td>
                        <td class="col-uom">{{ batch.uom }}</td>
                        @for (dq of batch.dailyQuantities; track dq.date) {
                          <td class="col-day num" [class.zero-qty]="dq.quantity === 0" [class.has-note]="dq.note">
                            @if (dq.note) {
                              <span [matTooltip]="dq.note">{{ dq.quantity }}</span>
                            } @else {
                              {{ dq.quantity | number }}
                            }
                          </td>
                        }
                        <td class="col-total num"><strong>{{ getBatchTotal(batch) | number }}</strong></td>
                      </tr>
                    }
                    <!-- Group subtotal -->
                    <tr class="subtotal-row">
                      <td colspan="4" class="subtotal-label">{{ group.scent }} {{ group.type }} Subtotal</td>
                      @for (d of scheduleDates; track d) {
                        <td class="col-day num">{{ getGroupDayTotal(group, d) | number }}</td>
                      }
                      <td class="col-total num">{{ getGroupTotal(group) | number }}</td>
                    </tr>
                  }
                } @empty {
                  <tr class="empty-row">
                    <td [attr.colspan]="4 + scheduleDates.length + 1">
                      @if (scheduleGroups.length === 0) {
                        <app-empty-state icon="inventory_2" title="No stock scheduled yet"
                                         message="Stock captured for the condoms project appears here, grouped by scent and type.">
                          <button mat-stroked-button (click)="openCaptureDialog()"><mat-icon>add_circle</mat-icon> Capture Stock</button>
                        </app-empty-state>
                      } @else {
                        <app-empty-state icon="filter_alt_off" title="No batches match these filters"
                                         message="None of the scheduled batches have this scent and type.">
                          <button mat-stroked-button (click)="clearFilters()">Clear the filters</button>
                        </app-empty-state>
                      }
                    </td>
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
      --surface: var(--color-surface);
      --surface-hover: var(--color-canvas);
      --border: var(--color-line);
      --text-primary: var(--color-text);
      --text-secondary: var(--color-text-3);
      --text-muted: var(--color-text-3);
      --radius: var(--radius-lg);
      --pink: var(--color-cat-pink);
      --pink-soft: var(--color-cat-pink-soft);
      --purple: var(--color-cat-purple);
      --purple-soft: var(--color-cat-purple-soft);
      --blue: var(--color-primary);
      --blue-soft: var(--color-primary-soft);
      --orange: var(--color-cat-amber);
      --orange-soft: var(--color-cat-amber-soft);
      --green: var(--color-cat-teal);
      --green-soft: var(--color-cat-teal-soft);
    }

    .dashboard-container {
      padding: 0 0 var(--space-6);
    }

    /* ── Back Row ── */
    .back-row {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-bottom: var(--space-5);
      flex-wrap: wrap;
    }

    .dashboard-title {
      color: var(--color-text);
      margin: 0;
      font-size: var(--text-xl);
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      letter-spacing: -0.01em;
    }

    .title-icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      color: var(--color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .title-icon-wrap mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .title-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .date-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      color: var(--color-text-2);
      padding: 6px 14px;
      border-radius: 999px;
      font-size: var(--text-xs);
      font-weight: 600;
    }
    .date-pill mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* ── Loading ── */
    .loading-state {
      background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm); overflow: hidden;
    }

    .error-container {
      background: var(--surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius);
      padding: 48px;
      text-align: center;
      box-shadow: var(--shadow-sm);
    }
    .error-icon-wrap {
      width: 64px; height: 64px; border-radius: 50%;
      background: var(--color-danger-soft); display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px;
    }
    .error-icon-wrap mat-icon { font-size: 32px; width: 32px; height: 32px; color: var(--color-danger); }
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
      border: 1px solid var(--color-line);
      border-radius: var(--radius);
      padding: 22px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: var(--shadow-sm);
      transition: box-shadow 0.2s ease, border-color 0.2s ease;
    }

    .kpi-card.clickable { cursor: pointer; }

    .kpi-card.clickable:hover {
      border-color: var(--color-line-strong);
      box-shadow: var(--shadow-md);
    }

    .kpi-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }
    .kpi-icon-wrap mat-icon { font-size: 24px; width: 24px; height: 24px; }

    .kpi-body { display: flex; flex-direction: column; }
    .kpi-number { font-size: var(--text-3xl); font-weight: 800; color: var(--text-primary); line-height: 1.2; letter-spacing: -0.5px; }
    .kpi-label { font-size: var(--text-xs); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px; }

    /* ============================== */
    /*  KPI DIALOG OVERLAY            */
    /* ============================== */
    .dialog-backdrop {
      position: fixed; inset: 0; background: var(--color-scrim);
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }
    .dialog-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 94vw; max-width: 720px; max-height: 85vh;
      background: var(--surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
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
      padding: 20px 24px 16px; display: flex; align-items: center;
      justify-content: space-between; border-bottom: 1px solid var(--border);
      background: var(--color-surface);
      flex-shrink: 0;
    }

    .dialog-title-group { display: flex; align-items: center; gap: 14px; }
    .dialog-icon-ring {
      width: 44px; height: 44px; border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      background: var(--color-primary-soft); color: var(--color-primary);
    }
    .dialog-batches .dialog-icon-ring { background: var(--pink-soft); color: var(--pink); }
    .dialog-female .dialog-icon-ring { background: var(--purple-soft); color: var(--purple); }
    .dialog-male .dialog-icon-ring { background: var(--blue-soft); color: var(--blue); }
    .dialog-scents .dialog-icon-ring { background: var(--orange-soft); color: var(--orange); }
    .dialog-icon-ring mat-icon { font-size: 24px; width: 24px; height: 24px; }

    .dialog-title { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.2; }
    .dialog-subtitle { font-size: var(--text-xs); color: var(--text-secondary); margin: 3px 0 0; }

    .dialog-close {
      width: 36px; height: 36px; border-radius: var(--radius-control); border: 1px solid var(--border);
      background: var(--surface); display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.15s; color: var(--text-secondary); flex-shrink: 0;
    }
    .dialog-close:hover { background: var(--color-surface-2); color: var(--color-text); }
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
      padding: 16px 18px; border-radius: var(--radius-md); text-align: center;
      display: flex; flex-direction: column; gap: 4px;
    }
    .dialog-stat.pink { background: var(--pink-soft); }
    .dialog-stat.purple { background: var(--purple-soft); }
    .dialog-stat.blue { background: var(--blue-soft); }
    .dialog-stat.orange { background: var(--orange-soft); }
    .dialog-stat.green { background: var(--green-soft); }
    .ds-val { font-size: var(--text-2xl); font-weight: 800; color: var(--text-primary); line-height: 1.2; }
    .ds-lbl { font-size: var(--text-xs); color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }

    .dialog-section-title {
      display: flex; align-items: center; gap: 8px;
      font-size: var(--text-md); font-weight: 700; color: var(--text-primary);
      margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border);
    }
    .dialog-section-title.spaced { margin-top: 20px; }
    .dialog-section-title mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--text-secondary); }

    /* Dialog Table */
    .dialog-table-wrap { overflow-x: auto; border-radius: var(--radius-md); border: 1px solid var(--border); }
    .primary-cell { font-weight: 600; }

    .scent-dot {
      display: inline-block; flex-shrink: 0; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle;
    }

    .type-pill {
      display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: var(--text-xs); font-weight: 700;
    }
    .type-pill-f { background: var(--pink-soft); color: var(--pink); }
    .type-pill-m { background: var(--blue-soft); color: var(--blue); }

    /* Dialog Bar Chart rows */
    .dialog-province-bars { display: flex; flex-direction: column; gap: 10px; }
    .bar-row { display: flex; align-items: center; gap: 12px; }
    .bar-row-label { width: 120px; font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); text-align: right; flex-shrink: 0; }
    .bar-track { flex: 1; height: 26px; background: var(--color-surface-2); border-radius: var(--radius-control); overflow: hidden; }
    .bar-fill { height: 100%; border-radius: var(--radius-control); transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); min-width: 4px; }
    .bar-row-value { width: 90px; font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }

    /* Scent Detail Cards (for scent dialog) */
    .scent-detail-cards { display: flex; flex-direction: column; gap: 12px; }
    .scent-detail-card {
      padding: 16px 20px; border-radius: var(--radius-md);
      border: 1px solid var(--border); border-left: 4px solid;
      background: var(--surface); transition: all 0.15s;
    }
    .scent-detail-card:hover { background: var(--surface-hover); box-shadow: var(--shadow-sm); }
    .sdc-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .sdc-info { display: flex; flex-direction: column; flex: 1; }
    .sdc-name { font-size: var(--text-md); font-weight: 700; color: var(--text-primary); }
    .sdc-types { font-size: var(--text-xs); color: var(--text-secondary); }
    .sdc-badge {
      padding: 4px 12px; border-radius: 999px; font-size: var(--text-xs); font-weight: 700;
    }
    .sdc-bar-wrapper { display: flex; align-items: center; gap: 12px; }
    .sdc-bar { flex: 1; height: 8px; background: var(--color-surface-2); border-radius: 4px; overflow: hidden; }
    .sdc-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
    .sdc-units { font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); white-space: nowrap; font-variant-numeric: tabular-nums; }

    /* ── Scent Breakdown Pod ── */
    .scent-pod {
      background: var(--surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius);
      padding: 20px 24px 24px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-sm);
    }

    .scent-pod-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }

    .scent-pod-title {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: var(--text-lg);
      color: var(--text-primary);
    }
    .scent-pod-title mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--text-secondary);
    }

    .scent-pod-view-toggle {
      display: flex;
      background: var(--color-surface-2);
      border-radius: var(--radius-md);
      padding: 3px;
      gap: 2px;
    }

    .view-toggle-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border: none;
      border-radius: var(--radius-control);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s;
    }
    .view-toggle-btn:hover {
      color: var(--color-text-2);
      background: var(--color-surface-3);
    }
    .view-toggle-btn.active {
      background: var(--color-surface);
      color: var(--color-primary);
      box-shadow: var(--shadow-sm);
    }
    .view-toggle-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    /* ── Scent List View ── */
    .scent-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .scent-list-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: var(--color-canvas);
      border-radius: var(--radius-md);
      border-left: 4px solid var(--color-line-strong);
      transition: background 0.2s;
    }
    .scent-list-item:hover {
      background: var(--color-surface-2);
    }

    .scent-list-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .scent-list-stats {
      display: flex;
      align-items: center;
      gap: 28px;
    }

    /* ── Scent Grid View (Cards) ── */
    .scent-cards-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 14px;
    }

    .scent-card {
      background: var(--surface);
      border: 1px solid var(--color-line);
      border-left: 4px solid var(--color-line-strong);
      border-radius: var(--radius-md);
      padding: 18px 20px;
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

    .scent-name { font-weight: 700; font-size: var(--text-lg); color: var(--text-primary); }

    .scent-card-stats { display: flex; gap: 20px; }
    .scs-item { display: flex; flex-direction: column; }
    .scs-val { font-weight: 800; font-size: var(--text-lg); color: var(--text-primary); }
    .scs-lbl { font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }

    /* ── Bar Chart ── */
    .chart-section {
      background: var(--surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-sm);
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
      font-size: var(--text-lg);
    }
    .section-header h3 mat-icon { color: var(--text-secondary); }

    .chart-legend {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: var(--text-xs);
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
    .legend-dot.female { background: var(--pink); }
    .legend-dot.male { background: var(--blue); }

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
      font-size: var(--text-xs);
      font-weight: 700;
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }

    .stacked-bar {
      width: 100%;
      max-width: 56px;
      border-radius: 8px 8px 0 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: height 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      min-height: 4px;
    }

    .bar-segment {
      width: 100%;
      transition: flex 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      min-height: 0;
    }

    .bar-segment.female {
      background: var(--pink);
    }

    .bar-segment.male {
      background: var(--blue);
    }

    .bar {
      width: 100%;
      max-width: 56px;
      border-radius: 8px 8px 0 0;
      transition: height 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      min-height: 4px;
    }

    .bar-label {
      font-size: var(--text-xs);
      color: var(--text-muted);
      text-align: center;
      line-height: 1.3;
      margin-top: 4px;
      font-weight: 500;
    }

    /* ── Schedule Table ── */
    .schedule-section {
      background: var(--surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius);
      padding: 24px;
      box-shadow: var(--shadow-sm);
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
      font-size: var(--text-lg);
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
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
    }

    .schedule-table {
      min-width: 900px;
    }

    .schedule-table thead th {
      z-index: 2;
    }

    .schedule-table thead th.weekend {
      background: var(--color-surface-3);
    }

    .col-scent { min-width: 80px; }
    .col-type { min-width: 60px; }
    .col-batch { min-width: 90px; }
    .col-uom { min-width: 55px; }
    .col-day { min-width: 55px; }
    .col-total { min-width: 65px; background: var(--color-canvas); }

    .date-header {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      line-height: 1.2;
      padding: 4px 0;
    }

    .day-name { font-size: var(--text-xs); font-weight: 600; }
    .day-num { font-size: var(--text-sm); font-weight: 800; color: var(--color-text); }
    .day-month { font-size: var(--text-xs); font-weight: 500; }

    /* Group header */
    .group-header-row { cursor: pointer; }

    .group-header-row td {
      font-size: var(--text-sm);
    }

    .group-header-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .group-count {
      margin-left: auto;
      font-size: var(--text-xs);
      color: var(--text-muted);
      font-weight: 600;
    }

    .group-chevron {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--text-secondary);
      transition: transform 0.25s ease;
      flex-shrink: 0;
    }

    .group-chevron.chevron-collapsed {
      transform: rotate(-90deg);
    }

    .app-table tbody tr.group-header-row:hover td {
      background: transparent;
    }

    .collapse-all-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--text-secondary);
      font-size: var(--text-xs);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      height: 40px;
    }

    .collapse-all-btn:hover {
      background: var(--surface-hover);
      border-color: var(--text-muted);
      color: var(--text-primary);
    }

    .collapse-all-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .zero-qty {
      color: var(--color-text-3);
    }

    .has-note {
      color: var(--color-warn);
      cursor: help;
      text-decoration: underline dotted var(--color-warn);
    }

    /* Subtotal row */
    .subtotal-row td {
      font-weight: 700;
      background: var(--color-surface-2);
      border-bottom: 1px solid var(--color-line-strong);
    }

    .subtotal-label {
      text-align: right;
      color: var(--text-secondary);
      font-style: italic;
    }

    .empty-row td { padding: 0; }
    .app-table tbody tr.empty-row:hover td { background: transparent; }

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
      font-size: var(--text-xs);
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .form-label .required {
      color: var(--color-danger);
    }

    .form-label .optional {
      color: var(--text-muted);
      font-weight: 500;
      text-transform: none;
      font-size: var(--text-xs);
    }

    .form-input, .form-select {
      padding: 10px 14px;
      border: 1px solid var(--color-line-strong);
      border-radius: var(--radius-control);
      font-size: var(--text-md);
      color: var(--text-primary);
      background: var(--surface);
      transition: all 0.15s;
      outline: none;
      font-family: inherit;
    }

    .form-input:focus, .form-select:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px var(--color-primary-soft);
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
      background: var(--color-surface-2);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      color: var(--text-primary);
    }
    .form-preview mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-primary);
    }
    .urgent-tag { color: var(--color-danger); }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
    }

    .btn-submit mat-spinner {
      display: inline-block;
      vertical-align: middle;
      margin-right: 6px;
      --mdc-circular-progress-active-indicator-color: currentColor;
    }

    .capture-success {
      text-align: center;
      padding: 24px 0;
    }

    .success-icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--color-ok-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .success-icon-wrap mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: var(--color-ok);
    }

    .capture-success h3 {
      color: var(--text-primary);
      font-weight: 700;
      margin: 0 0 6px;
    }

    .capture-success p {
      color: var(--text-secondary);
      margin: 0 0 20px;
      font-size: var(--text-md);
    }

    .success-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
    }

    .capture-error {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--color-danger-soft);
      border-radius: var(--radius-control);
      color: var(--color-danger);
      font-size: var(--text-sm);
      font-weight: 600;
      margin-bottom: 16px;
    }
    .capture-error mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    /* ── Address Autocomplete ── */
    .address-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .address-loc-icon {
      position: absolute;
      left: 12px;
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-text-3);
      z-index: 1;
      pointer-events: none;
    }
    .address-input {
      flex: 1;
      padding-left: 40px;
      padding-right: 40px;
    }
    .address-verified {
      position: absolute;
      right: 12px;
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-ok);
      animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes popIn {
      0% { transform: scale(0); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .address-confirmed-text {
      display: block;
      font-size: var(--text-xs);
      color: var(--color-ok);
      font-weight: 600;
      margin-top: 4px;
      padding-left: 2px;
    }

    /* ── Responsive ── */
    @media (max-width: 1100px) {
      .kpi-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 768px) {
      .dashboard-container { padding: 0 0 var(--space-5); }
      .back-row { flex-direction: column; align-items: flex-start; }
      .dashboard-title { font-size: var(--text-2xl); }
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .scent-cards-row { grid-template-columns: 1fr 1fr; }
      .schedule-filters { flex-direction: column; }
      .filter-field { width: 100%; }
      .dialog-panel { max-width: 95vw; }
    }
    @media (max-width: 600px) {
      .kpi-grid { grid-template-columns: 1fr 1fr; }
      .dialog-panel { width: 100vw; max-height: 95vh; border-radius: var(--radius-lg) var(--radius-lg) 0 0; }
      .dialog-header { padding: 18px 20px 16px; }
    }

    /* Delivery Password Dialog */
    .pwd-dialog {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); padding: 32px; width: 380px; max-width: 90vw;
      text-align: center; box-shadow: var(--shadow-lg); z-index: 1200;
    }
    .pwd-lock-icon { font-size: 48px; width: 48px; height: 48px; color: var(--color-primary); margin-bottom: 12px; }
    .pwd-dialog h3 { margin: 0 0 8px 0; font-size: var(--text-2xl); color: var(--color-text); }
    .pwd-dialog p { margin: 0 0 20px 0; color: var(--color-text-2); font-size: var(--text-md); }
    .pwd-input { width: 100%; margin-bottom: 16px; }
    .pwd-actions { display: flex; gap: 12px; justify-content: center; }
    .pwd-error { color: var(--color-danger); font-size: var(--text-sm); margin: -8px 0 12px 0; }
  `]
})
export class CondomsDashboardComponent implements OnInit {
  @Output() goBack = new EventEmitter<void>();
  @ViewChild('deliveryAddressInput') deliveryAddressInputRef!: ElementRef<HTMLInputElement>;

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
  collapsedGroups = new Set<string>();

  // Scent pod view toggle
  scentPodView: 'list' | 'grid' = 'list';

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

  // Request Delivery
  showDeliveryDialog = false;
  deliverySaving = false;
  deliveryError = '';
  deliverySuccess = false;
  deliverySuccessMsg = '';
  // Delivery password gate
  showDeliveryPasswordDialog = false;
  deliveryPasswordInput = '';
  deliveryPasswordError = '';
  private readonly DELIVERY_PASSWORD = '0000';
  addressVerified = false;
  private autocomplete: google.maps.places.Autocomplete | null = null;
  private readonly mapsLoader = inject(GoogleMapsLoaderService);
  deliveryForm = {
    invoiceNumber: '',
    scent: '',
    type: '',
    quantity: 0,
    unitOfMeasure: 'CASES',
    description: '',
    deliveryAddress: '',
    notes: '',
    priority: 'Normal'
  };

  private maxDailyTotal = 0;

  ngOnInit(): void {
    this.loadData();
  }

  constructor(private http: HttpClient, private ngZone: NgZone) {}

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

  // ── Request Delivery Methods ──

  showDeliveryPasswordPrompt(): void {
    this.deliveryPasswordInput = '';
    this.deliveryPasswordError = '';
    this.showDeliveryPasswordDialog = true;
  }

  verifyDeliveryPassword(): void {
    if (this.deliveryPasswordInput === this.DELIVERY_PASSWORD) {
      this.showDeliveryPasswordDialog = false;
      this.deliveryPasswordInput = '';
      this.deliveryPasswordError = '';
      this.openRequestDeliveryDialog();
    } else {
      this.deliveryPasswordError = 'Incorrect password. Please try again.';
      this.deliveryPasswordInput = '';
    }
  }

  cancelDeliveryPassword(): void {
    this.showDeliveryPasswordDialog = false;
    this.deliveryPasswordInput = '';
    this.deliveryPasswordError = '';
  }

  openRequestDeliveryDialog(): void {
    this.resetDeliveryForm();
    this.showDeliveryDialog = true;
    setTimeout(() => this.initAddressAutocomplete(), 150);
  }

  closeDeliveryDialog(): void {
    this.showDeliveryDialog = false;
    this.deliveryError = '';
    this.deliverySuccess = false;
    this.autocomplete = null;
  }

  resetDeliveryForm(): void {
    this.deliveryForm = {
      invoiceNumber: '',
      scent: '',
      type: '',
      quantity: 0,
      unitOfMeasure: 'CASES',
      description: '',
      deliveryAddress: '',
      notes: '',
      priority: 'Normal'
    };
    this.deliveryError = '';
    this.deliverySuccess = false;
    this.deliverySuccessMsg = '';
    this.deliverySaving = false;
    this.addressVerified = false;
    setTimeout(() => this.initAddressAutocomplete(), 150);
  }

  isDeliveryFormValid(): boolean {
    return !!(this.deliveryForm.description.trim() && this.deliveryForm.quantity > 0);
  }

  submitDeliveryRequest(): void {
    if (!this.isDeliveryFormValid()) return;

    this.deliverySaving = true;
    this.deliveryError = '';

    const payload = {
      department: 'Condoms',
      invoiceNumber: this.deliveryForm.invoiceNumber?.trim() || null,
      scent: this.deliveryForm.scent || null,
      type: this.deliveryForm.type || null,
      quantity: this.deliveryForm.quantity,
      unitOfMeasure: this.deliveryForm.unitOfMeasure || 'CASES',
      description: this.deliveryForm.description.trim(),
      deliveryAddress: this.deliveryForm.deliveryAddress?.trim() || null,
      notes: this.deliveryForm.notes?.trim() || null,
      priority: this.deliveryForm.priority || 'Normal'
    };

    this.http.post<any>(`${environment.apiUrl}/condomproject/delivery-requests`, payload).subscribe({
      next: (res) => {
        this.deliverySaving = false;
        this.deliverySuccess = true;
        this.deliverySuccessMsg = `Delivery request ${res.referenceNumber || ''} submitted to logistics.`;
      },
      error: (err) => {
        this.deliverySaving = false;
        this.deliveryError = err.error?.error || err.error?.message || 'Failed to submit delivery request. Please try again.';
      }
    });
  }

  private async initAddressAutocomplete(): Promise<void> {
    try { await this.mapsLoader.load(); } catch { return; } // key fetched from the API, script injected once
    if (!this.deliveryAddressInputRef?.nativeElement) return;
    if (typeof google === 'undefined' || !google.maps?.places) return;
    this.autocomplete = new google.maps.places.Autocomplete(
      this.deliveryAddressInputRef.nativeElement,
      { types: ['address'], componentRestrictions: { country: 'za' } }
    );
    this.autocomplete.addListener('place_changed', () => {
      this.ngZone.run(() => {
        const place = this.autocomplete!.getPlace();
        if (place?.formatted_address) {
          this.deliveryForm.deliveryAddress = place.formatted_address;
          this.addressVerified = true;
        } else if (place?.name) {
          this.deliveryForm.deliveryAddress = place.name;
          this.addressVerified = true;
        }
      });
    });
  }

  // ── Filter ──

  applyFilter(): void {
    this.filteredGroups = this.scheduleGroups.filter(g => {
      const scentMatch = this.filterScent === 'all' || g.scent === this.filterScent;
      const typeMatch = this.filterType === 'all' || g.type === this.filterType;
      return scentMatch && typeMatch;
    });
    // Clear collapsed state for groups no longer visible
    this.collapsedGroups.forEach(key => {
      if (!this.filteredGroups.some(g => g.scentGroup === key)) {
        this.collapsedGroups.delete(key);
      }
    });
  }

  clearFilters(): void {
    this.filterScent = 'all';
    this.filterType = 'all';
    this.applyFilter();
  }

  toggleGroupCollapse(scentGroup: string): void {
    if (this.collapsedGroups.has(scentGroup)) {
      this.collapsedGroups.delete(scentGroup);
    } else {
      this.collapsedGroups.add(scentGroup);
    }
  }

  toggleAllGroups(): void {
    if (this.collapsedGroups.size === this.filteredGroups.length) {
      // All collapsed → expand all
      this.collapsedGroups.clear();
    } else {
      // Collapse all
      this.filteredGroups.forEach(g => this.collapsedGroups.add(g.scentGroup));
    }
  }

  // ── Helpers ──

  private readonly scentCategories: Record<string, string> = {
    'Vanilla': 'teal',
    'Strawberry': 'pink',
    'Banana': 'amber',
    'Grape': 'purple'
  };

  getScentColor(scent: string): string {
    const cat = this.scentCategories[scent];
    return cat ? `var(--color-cat-${cat})` : 'var(--color-text-3)';
  }

  getScentSoft(scent: string): string {
    const cat = this.scentCategories[scent];
    return cat ? `var(--color-cat-${cat}-soft)` : 'var(--color-surface-2)';
  }

  getBarHeight(total: number): number {
    if (this.maxDailyTotal === 0) return 0;
    return (total / this.maxDailyTotal) * 85;
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
