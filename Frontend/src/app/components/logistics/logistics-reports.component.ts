import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { StatusChipComponent, ChipTone } from '../../ui/status-chip/status-chip.component';

interface Incident {
  id: number;
  type: string;
  severity: string;
  registration: string;
  driver?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  speed?: number;
  zone?: string;
  distanceMeters?: number;
  duringCurfew: boolean;
  details?: string;
  occurredAtSast: string;
}

/**
 * Daily security/monitoring incident reports. Logs every alert captured by the
 * controller/open map: Speeding, Curfew Movement (moving during 18:00-05:00),
 * and Geofence Exit (leaving a parking/depot zone during curfew). Categorised,
 * date-filtered and exportable to Excel.
 */
@Component({
  selector: 'app-logistics-reports',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule,
    MatTooltipModule, MatTabsModule, MatDialogModule,
    SkeletonRowsComponent, EmptyStateComponent, StatusChipComponent
  ],
  template: `
  <div class="reports-wrap">
    <!-- Tab selector -->
    <mat-tab-group class="reports-tabs" [(selectedIndex)]="activeTab">
      <!-- Tab 1: Daily Incidents -->
      <mat-tab>
        <ng-template mat-tab-label>
          <mat-icon>assessment</mat-icon>
          <span>Daily Incidents</span>
        </ng-template>
        <div class="tab-content">
    <!-- Toolbar -->
    <div class="rep-toolbar">
      <div class="rep-title">
        <mat-icon>assessment</mat-icon>
        <div>
          <h2>Daily Incident Reports</h2>
          <p>Curfew 18:00–05:00 · speeding, curfew movement & geofence exits</p>
        </div>
      </div>
      <div class="rep-controls">
        <mat-form-field appearance="outline" class="date-field">
          <mat-label>Report date</mat-label>
          <input matInput [matDatepicker]="picker" [(ngModel)]="selectedDate" (dateChange)="load()">
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>
        <button aria-label="Previous day" mat-icon-button (click)="stepDay(-1)" matTooltip="Previous day"><mat-icon>chevron_left</mat-icon></button>
        <button aria-label="Next day" mat-icon-button (click)="stepDay(1)" matTooltip="Next day"><mat-icon>chevron_right</mat-icon></button>
        <button mat-stroked-button (click)="load()" matTooltip="Refresh"><mat-icon>refresh</mat-icon> Refresh</button>
        <button mat-flat-button color="primary" (click)="exportExcel()" [disabled]="summary().total === 0">
          <mat-icon>file_download</mat-icon> Export Excel
        </button>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="rep-summary">
      <div class="sum-card total" [class.on]="typeFilter()==='all'" (click)="typeFilter.set('all')">
        <mat-icon>list_alt</mat-icon>
        <div><span class="sc-val">{{ summary().total }}</span><span class="sc-lbl">Total Incidents</span></div>
      </div>
      <div class="sum-card speeding" [class.on]="typeFilter()==='Speeding'" (click)="typeFilter.set('Speeding')">
        <mat-icon>speed</mat-icon>
        <div><span class="sc-val">{{ summary().speeding }}</span><span class="sc-lbl">Speeding</span></div>
      </div>
      <div class="sum-card curfew" [class.on]="typeFilter()==='CurfewMovement'" (click)="typeFilter.set('CurfewMovement')">
        <mat-icon>nightlight</mat-icon>
        <div><span class="sc-val">{{ summary().curfewMovement }}</span><span class="sc-lbl">Curfew Movement</span></div>
      </div>
      <div class="sum-card geofence" [class.on]="typeFilter()==='GeofenceExit'" (click)="typeFilter.set('GeofenceExit')">
        <mat-icon>wrong_location</mat-icon>
        <div><span class="sc-val">{{ summary().geofenceExit }}</span><span class="sc-lbl">Geofence Exit</span></div>
      </div>
      <div class="sum-card vehicles">
        <mat-icon>local_shipping</mat-icon>
        <div><span class="sc-val">{{ summary().vehiclesInvolved }}</span><span class="sc-lbl">Vehicles Involved</span></div>
      </div>
    </div>

    @if (loading()) {
      <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows>
    } @else if (visibleIncidents().length === 0) {
      @if (typeFilter() !== 'all' && incidents().length > 0) {
        <app-empty-state icon="filter_alt_off"
                         title="No {{ typeLabel(typeFilter()) }} incidents on {{ selectedDate | date:'dd MMM yyyy' }}"
                         message="Other kinds of incident were logged that day.">
          <button mat-stroked-button (click)="typeFilter.set('all')">Show all incidents</button>
        </app-empty-state>
      } @else {
        <app-empty-state icon="verified"
                         title="No incidents logged for {{ selectedDate | date:'dd MMM yyyy' }}"
                         message="Incidents are recorded automatically while the Controller or Open Map is being monitored."></app-empty-state>
      }
    } @else {
      <div class="rep-table-wrap">
        <table class="app-table">
          <thead>
            <tr>
              <th>Time</th><th>Type</th><th>Registration</th><th>Driver</th>
              <th class="num">Speed</th><th>Zone / Distance</th><th>Curfew</th><th>Details</th>
            </tr>
          </thead>
          <tbody>
            @for (i of visibleIncidents(); track i.id) {
              <tr>
                <td class="mono">{{ i.occurredAtSast | date:'HH:mm:ss' }}</td>
                <td>
                  <span class="type-badge" [ngClass]="'t-'+i.type">
                    <mat-icon>{{ typeIcon(i.type) }}</mat-icon> {{ typeLabel(i.type) }}
                  </span>
                </td>
                <td class="ref strong">{{ i.registration }}</td>
                <td>{{ i.driver || '—' }}</td>
                <td class="num">{{ i.speed ? (i.speed | number:'1.0-0') + ' km/h' : '—' }}</td>
                <td>
                  @if (i.zone) { {{ i.zone }}@if (i.distanceMeters) { <span class="dist"> · {{ i.distanceMeters | number:'1.0-0' }}m out</span> } }
                  @else { — }
                </td>
                <td>
                  <app-status-chip [status]="i.duringCurfew ? 'Yes' : 'No'" [tone]="i.duringCurfew ? 'danger' : 'neutral'"></app-status-chip>
                </td>
                <td class="details">{{ i.details || '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
        </div>
      </mat-tab>

      <!-- Tab 2: Flagged Fuel Health -->
      <mat-tab>
        <ng-template mat-tab-label>
          <mat-icon>local_gas_station</mat-icon>
          <span>Flagged Fuel Health</span>
        </ng-template>
        <div class="tab-content">
          <div class="fuel-health-section">
            <div class="fuel-title">
              <mat-icon>local_gas_station</mat-icon>
              <div>
                <h2>Suspicious Fuel Health Ratings</h2>
                <p>Vehicles flagged for potential fuel loss, theft, or engine problems</p>
              </div>
            </div>
            <div class="fuel-controls">
              <mat-form-field appearance="outline">
                <mat-label>Days to analyze</mat-label>
                <input matInput type="number" [(ngModel)]="fuelAnalysisDays" min="7" max="180" (change)="loadFuelAnalysis()">
              </mat-form-field>
              <button mat-stroked-button (click)="loadFuelAnalysis()" matTooltip="Refresh fuel analysis">
                <mat-icon>refresh</mat-icon> Refresh
              </button>
              <button mat-flat-button color="primary" (click)="exportFuelHealthExcel()" [disabled]="!flaggedFuelVehicles() || flaggedFuelVehicles().length === 0">
                <mat-icon>file_download</mat-icon> Export Excel
              </button>
            </div>

            @if (fuelAnalysisLoading()) {
              <app-skeleton-rows [rows]="4" [avatar]="false"></app-skeleton-rows>
            } @else if (!flaggedFuelVehicles() || flaggedFuelVehicles().length === 0) {
              <app-empty-state icon="verified" title="No vehicles flagged"
                               message="All vehicles have healthy fuel consumption patterns."></app-empty-state>
            } @else {
              <div class="fuel-cards-grid">
                @for (vehicle of flaggedFuelVehicles(); track vehicle.vehicleId) {
                  <div class="fuel-card" [class]="'risk-' + vehicle.riskLevel" [class.expanded]="vehicle._expanded" (click)="openFuelHealthDetail(vehicle)">
                    <div class="fuel-card-header">
                      <div class="reg-badge">
                        <mat-icon>directions_car</mat-icon>
                        {{ vehicle.registrationNumber }}
                      </div>
                      <app-status-chip [status]="riskLabel(vehicle.riskLevel)" [tone]="riskTone(vehicle.riskLevel)"></app-status-chip>
                    </div>
                    @if (vehicle.make || vehicle.model) {
                      <div class="veh-sub">{{ vehicle.make }} {{ vehicle.model }}</div>
                    }
                    <div class="fuel-card-content">
                      <div class="metric">
                        <label>Risk Score</label>
                        <span class="value">{{ vehicle.riskScore | number:'1.0-0' }}/100</span>
                      </div>
                      <div class="metric">
                        <label>Flagged Fills</label>
                        <span class="value">{{ vehicle.flaggedFills ?? 0 }} of {{ vehicle.fillCount ?? 0 }}</span>
                      </div>
                      <div class="metric">
                        <label>Actual km/L</label>
                        <span class="value">
                          {{ vehicle.actualKmPerLitre ? (vehicle.actualKmPerLitre | number:'1.1-1') : '—' }}
                          <span class="expected">/ exp {{ vehicle.expectedKmPerLitre | number:'1.1-1' }}</span>
                        </span>
                      </div>
                      <div class="metric">
                        <label>Total Fuel</label>
                        <span class="value">{{ vehicle.totalLitres | number:'1.0-0' }}L · R{{ vehicle.totalAmount | number:'1.0-0' }}</span>
                      </div>
                    </div>
                    <div class="fuel-card-footer">
                      <span class="reason">{{ vehicle.anomalyReason }}</span>
                      <mat-icon>{{ vehicle._expanded ? 'expand_less' : 'expand_more' }}</mat-icon>
                    </div>

                    @if (vehicle._expanded) {
                      <div class="fuel-detail" (click)="$event.stopPropagation()">
                        @if (vehicle._findings?.length) {
                          <div class="detail-block">
                            <h4><mat-icon>report_problem</mat-icon> Findings ({{ vehicle._findings.length }})</h4>
                            @for (f of vehicle._findings; track $index) {
                              <div class="finding" [class]="severityClass(f.severity)">
                                <span class="sev-dot"></span>
                                <div class="finding-body">
                                  <span class="finding-msg">{{ f.message }}</span>
                                  @if (f.date) { <span class="finding-date">{{ f.date | date:'dd MMM yyyy' }}</span> }
                                </div>
                              </div>
                            }
                          </div>
                        }
                        @if (vehicle._fills?.length) {
                          <div class="detail-block">
                            <h4><mat-icon>local_gas_station</mat-icon> Fill Breakdown ({{ vehicle._fills.length }})</h4>
                            <div class="fills-table">
                              <div class="fill-row head">
                                <span>Date</span><span>Litres</span><span>Amount</span><span>Km</span><span>Tank %</span><span>Flag</span>
                              </div>
                              @for (fill of vehicle._fills; track $index) {
                                <div class="fill-row" [class.flagged]="fill.flag">
                                  <span>{{ fill.date | date:'dd MMM' }}</span>
                                  <span>{{ fill.litres | number:'1.0-0' }}L</span>
                                  <span>R{{ fill.amount | number:'1.0-0' }}</span>
                                  <span>{{ fill.kmSinceLastFill ? (fill.kmSinceLastFill | number:'1.0-0') : '—' }}</span>
                                  <span>{{ fill.fillVsTankPercent != null ? fill.fillVsTankPercent + '%' : '—' }}</span>
                                  <span class="fill-flag" [matTooltip]="fill.flag || ''">
                                    <mat-icon [class.flag-on]="fill.flag" [attr.aria-label]="fill.flag ? 'Flagged' : 'OK'">{{ fill.flag ? 'warning' : 'check' }}</mat-icon>
                                  </span>
                                </div>
                              }
                            </div>
                          </div>
                        }
                        @if (!vehicle._findings?.length && !vehicle._fills?.length) {
                          <div class="detail-empty">No detailed fill data available for this window.</div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </mat-tab>
    </mat-tab-group>
  </div>
  `,
  styles: [`
    .reports-wrap { display:flex; flex-direction:column; gap:16px; padding:20px; background:var(--color-canvas); border-radius:var(--radius-lg); min-height:70vh; }

    /* Tab styling */
    ::ng-deep .reports-tabs .mat-mdc-tab-header { background: var(--color-surface); border-bottom: 1px solid var(--color-line); border-radius: var(--radius-md) var(--radius-md) 0 0; }
    ::ng-deep .reports-tabs .mat-mdc-tab .mdc-tab__text-label { color: var(--color-text-3); }
    ::ng-deep .reports-tabs .mat-mdc-tab-active .mdc-tab__text-label { color: var(--color-primary); }
    ::ng-deep .reports-tabs .mat-mdc-tab .mdc-tab__text-label mat-icon { margin-right: 6px; }
    .tab-content { padding: 20px 0; }

    .rep-toolbar { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
    .rep-title { display:flex; align-items:center; gap:12px; }
    .rep-title > mat-icon { font-size:32px; width:32px; height:32px; color:var(--color-primary); }
    .rep-title > div { display:flex; flex-direction:column; gap:4px; }
    .rep-title h2 { margin:0; font-size:var(--text-2xl); color:var(--color-text); }
    .rep-title p { margin:0; font-size:var(--text-xs); color:var(--color-text-3); }
    .rep-controls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .date-field { width:160px; }
    ::ng-deep .rep-controls .mat-mdc-text-field-wrapper { padding: 0; }

    .rep-summary { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; }
    .sum-card { display:flex; align-items:center; gap:12px; padding:14px; background:var(--color-surface); border:1px solid var(--color-line); border-radius:8px; cursor:pointer; transition:all .2s ease; box-shadow: var(--shadow-sm); }
    .sum-card:hover { border-color:var(--color-line-strong); transform:translateY(-2px); box-shadow: var(--shadow-md); }
    .sum-card.on { background:var(--color-primary-soft); border-color:var(--color-primary); }
    .sum-card > mat-icon { font-size:24px; width:24px; height:24px; }
    .sum-card.total > mat-icon { color:var(--color-primary); }
    .sum-card.speeding > mat-icon { color:var(--color-warn); }
    .sum-card.curfew > mat-icon { color:var(--color-cat-purple); }
    .sum-card.geofence > mat-icon { color:var(--color-danger); }
    .sum-card.vehicles > mat-icon { color:var(--color-cat-teal); }
    .sum-card > div { display:flex; flex-direction:column; gap:2px; }
    .sc-val { font-size:var(--text-xl); font-weight:600; color:var(--color-text); font-variant-numeric:tabular-nums; }
    .sc-lbl { font-size:var(--text-xs); color:var(--color-text-3); }

    .rep-table-wrap { overflow-x:auto; border-radius:8px; border:1px solid var(--color-line); background:var(--color-surface); }
    .rep-table-wrap .mono { font-family:var(--font-mono); font-size:var(--text-xs); }
    .rep-table-wrap .strong { font-weight:600; }
    .type-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:6px; font-size:var(--text-xs); font-weight:600; white-space:nowrap; }
    .type-badge > mat-icon { font-size:14px; width:14px; height:14px; }
    .t-Speeding { background:var(--color-warn-soft); color:var(--color-warn); }
    .t-CurfewMovement { background:var(--color-cat-purple-soft); color:var(--color-cat-purple); }
    .t-GeofenceExit { background:var(--color-danger-soft); color:var(--color-danger); }
    .dist { color:var(--color-text-3); font-size:var(--text-xs); }

    /* Fuel Health Section */
    .fuel-health-section { display:flex; flex-direction:column; gap:20px; }
    .fuel-title { display:flex; align-items:center; gap:12px; }
    .fuel-title > mat-icon { font-size:32px; width:32px; height:32px; color:var(--color-warn); }
    .fuel-title > div { display:flex; flex-direction:column; gap:4px; }
    .fuel-title h2 { margin:0; font-size:var(--text-2xl); color:var(--color-text); }
    .fuel-title p { margin:0; font-size:var(--text-xs); color:var(--color-text-3); }
    .fuel-controls { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
    ::ng-deep .fuel-controls .mat-mdc-form-field { width: 140px; }

    .fuel-cards-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px; align-items:start; }
    .fuel-card { display:flex; flex-direction:column; padding:16px; background:var(--color-surface); border:1px solid var(--color-line); border-radius:8px; cursor:pointer; transition:all .2s ease; box-shadow: var(--shadow-sm); }
    .fuel-card:hover { transform:translateY(-4px); border-color:var(--color-line-strong); box-shadow: var(--shadow-md); }
    .fuel-card.expanded { transform:none; box-shadow: var(--shadow-lg); grid-column: 1 / -1; }
    .fuel-card.risk-high { border-left:4px solid var(--color-danger); }
    .fuel-card.risk-watch { border-left:4px solid var(--color-warn); }
    .fuel-card.risk-normal { border-left:4px solid var(--color-ok); }

    .fuel-card-header { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px; }
    .reg-badge { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; background:var(--color-primary-soft); color:var(--color-primary); border-radius:6px; font-weight:700; font-size:var(--text-md); letter-spacing:0.3px; }
    .reg-badge mat-icon { font-size:18px; width:18px; height:18px; }
    .veh-sub { font-size:var(--text-xs); color:var(--color-text-3); margin-bottom:10px; }

    .fuel-card-content { display:flex; flex-direction:column; gap:10px; margin-bottom:12px; }
    .metric { display:flex; justify-content:space-between; align-items:center; }
    .metric > label { font-size:var(--text-xs); color:var(--color-text-3); }
    .metric > .value { font-weight:600; font-size:var(--text-md); color:var(--color-text); font-variant-numeric:tabular-nums; }
    .metric .expected { font-weight:400; font-size:var(--text-xs); color:var(--color-text-3); margin-left:4px; }

    .fuel-card-footer { display:flex; justify-content:space-between; align-items:center; gap:8px; padding-top:10px; border-top:1px solid var(--color-line); }
    .reason { font-size:var(--text-xs); color:var(--color-text-3); flex:1; }
    .fuel-card-footer > mat-icon { font-size:20px; width:20px; height:20px; color:var(--color-text-3); flex-shrink:0; }

    /* Expanded detail */
    .fuel-detail { margin-top:14px; padding-top:14px; border-top:2px dashed var(--color-line); display:flex; flex-direction:column; gap:16px; cursor:default; }
    .detail-block h4 { display:flex; align-items:center; gap:6px; margin:0 0 10px; font-size:var(--text-sm); color:var(--color-text-2); }
    .detail-block h4 mat-icon { font-size:18px; width:18px; height:18px; color:var(--color-warn); }
    .finding { display:flex; align-items:flex-start; gap:8px; padding:8px 10px; border-radius:6px; background:var(--color-canvas); margin-bottom:6px; }
    .finding .sev-dot { width:8px; height:8px; border-radius:50%; margin-top:5px; flex-shrink:0; }
    .finding.sev-high .sev-dot { background:var(--color-danger); }
    .finding.sev-medium .sev-dot { background:var(--color-warn); }
    .finding.sev-low .sev-dot { background:var(--color-info); }
    .finding.sev-high { background:var(--color-danger-soft); }
    .finding-body { display:flex; flex-direction:column; gap:2px; }
    .finding-msg { font-size:var(--text-sm); color:var(--color-text-2); }
    .finding-date { font-size:var(--text-xs); color:var(--color-text-3); }
    .fills-table { display:flex; flex-direction:column; font-size:var(--text-xs); border:1px solid var(--color-line); border-radius:6px; overflow:hidden; font-variant-numeric:tabular-nums; }
    .fill-row { display:grid; grid-template-columns:1fr 0.8fr 0.9fr 0.7fr 0.7fr 0.5fr; gap:6px; padding:7px 10px; align-items:center; border-bottom:1px solid var(--color-surface-2); color:var(--color-text); }
    .fill-row.head { background:var(--color-surface-2); font-weight:700; color:var(--color-text-2); font-size:var(--text-xs); }
    .fill-row.flagged { background:var(--color-warn-soft); }
    .fill-row:last-child { border-bottom:none; }
    .fill-flag { display:flex; justify-content:center; }
    .fill-flag mat-icon { font-size:16px; width:16px; height:16px; color:var(--color-ok); }
    .fill-flag mat-icon.flag-on { color:var(--color-warn); }
    .detail-empty { font-size:var(--text-xs); color:var(--color-text-3); padding:10px; text-align:center; }
  `]
})
export class LogisticsReportsComponent implements OnInit {
  selectedDate: Date = new Date();
  loading = signal(false);
  incidents = signal<Incident[]>([]);
  typeFilter = signal<string>('all');
  summary = signal<{ total: number; speeding: number; curfewMovement: number; geofenceExit: number; vehiclesInvolved: number }>(
    { total: 0, speeding: 0, curfewMovement: 0, geofenceExit: 0, vehiclesInvolved: 0 }
  );

  // Fuel Health Report
  activeTab = 0;
  fuelAnalysisDays = 30;
  fuelAnalysisLoading = signal(false);
  flaggedFuelVehicles = signal<any[]>([]);

  visibleIncidents = computed(() => {
    const f = this.typeFilter();
    return f === 'all' ? this.incidents() : this.incidents().filter(i => i.type === f);
  });

  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.load(); this.loadFuelAnalysis(); }

  private headers(): HttpHeaders {
    const t = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${t}` });
  }

  private dateStr(): string {
    const d = this.selectedDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  load(): void {
    this.loading.set(true);
    this.http.get<any>(`${environment.apiUrl}/logistics/reports/incidents?date=${this.dateStr()}`, { headers: this.headers() })
      .subscribe({
        next: (res) => {
          this.incidents.set(res.incidents || []);
          this.summary.set(res.summary || { total: 0, speeding: 0, curfewMovement: 0, geofenceExit: 0, vehiclesInvolved: 0 });
          this.loading.set(false);
        },
        error: () => { this.incidents.set([]); this.loading.set(false); }
      });
  }

  stepDay(delta: number): void {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + delta);
    this.selectedDate = d;
    this.load();
  }

  exportExcel(): void {
    this.http.get(`${environment.apiUrl}/logistics/reports/incidents/export?date=${this.dateStr()}`, {
      headers: this.headers(), responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `IncidentReport_${this.dateStr()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast.done('Incident report exported');
      },
      error: () => this.toast.error('Failed to export report')
    });
  }

  typeLabel(t: string): string {
    return t === 'CurfewMovement' ? 'Curfew Movement' : t === 'GeofenceExit' ? 'Geofence Exit' : t;
  }
  typeIcon(t: string): string {
    return t === 'Speeding' ? 'speed' : t === 'CurfewMovement' ? 'nightlight' : 'wrong_location';
  }

  // Fuel Health Report Methods
  loadFuelAnalysis(): void {
    this.fuelAnalysisLoading.set(true);
    this.http.get<any>(`${environment.apiUrl}/fleet/fuel-analysis?days=${this.fuelAnalysisDays}`, { headers: this.headers() })
      .subscribe({
        next: (res) => {
          const flagged = (res.vehicles || [])
            .filter((v: any) => v.riskLevel === 'high' || v.riskLevel === 'watch')
            .map((v: any) => {
              const findings = v.findings || [];
              const fills = v.fills || [];
              const flaggedFills = fills.filter((f: any) => f.flag || (f.severity && f.severity !== 'ok')).length;
              // Sort findings by severity so the worst reason surfaces
              const sevRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
              const topFinding = [...findings].sort((a: any, b: any) =>
                (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0))[0];
              return {
                ...v,
                registrationNumber: v.registration || v.registrationNumber || 'Unknown',
                flaggedFills,
                findingsCount: findings.length,
                anomalyReason: topFinding?.message || (findings.length ? `${findings.length} finding(s)` : 'Consumption outside expected range'),
                actualKmPerLitre: v.actualKmPerLitre,
                expectedKmPerLitre: v.expectedKmPerLitre,
                _findings: findings,
                _fills: fills,
                _expanded: false
              };
            });
          // Worst risk first
          flagged.sort((a: any, b: any) => (b.riskScore || 0) - (a.riskScore || 0));
          this.flaggedFuelVehicles.set(flagged);
          this.fuelAnalysisLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load fuel analysis:', err);
          this.flaggedFuelVehicles.set([]);
          this.fuelAnalysisLoading.set(false);
        }
      });
  }

  exportFuelHealthExcel(): void {
    const vehicles = this.flaggedFuelVehicles();
    if (!vehicles || vehicles.length === 0) {
      this.toast.info('No flagged vehicles to export');
      return;
    }

    this.http.get(`${environment.apiUrl}/fleet/fuel-analysis/export?days=${this.fuelAnalysisDays}`, {
      headers: this.headers(), responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `FlaggedFuelHealth_${dateStr}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast.done(`Exported ${vehicles.length} flagged vehicle(s)`);
      },
      error: () => this.toast.error('Failed to export fuel health report')
    });
  }

  openFuelHealthDetail(vehicle: any): void {
    // Toggle the inline detail panel for this vehicle
    vehicle._expanded = !vehicle._expanded;
    this.flaggedFuelVehicles.update(list => [...list]);
  }

  severityClass(sev: string): string {
    return 'sev-' + (sev || 'medium').toLowerCase();
  }

  riskLabel(level: string): string {
    return level === 'high' ? 'High risk' : level === 'watch' ? 'Watch' : (level || '');
  }

  riskTone(level: string): ChipTone {
    return level === 'high' ? 'danger' : level === 'watch' ? 'warn' : level === 'normal' ? 'ok' : 'neutral';
  }
}
