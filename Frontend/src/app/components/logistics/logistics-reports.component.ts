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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { environment } from '../../../environments/environment';

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
    MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule, MatTabsModule, MatDialogModule
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
        <button mat-icon-button (click)="stepDay(-1)" matTooltip="Previous day"><mat-icon>chevron_left</mat-icon></button>
        <button mat-icon-button (click)="stepDay(1)" matTooltip="Next day"><mat-icon>chevron_right</mat-icon></button>
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
      <div class="rep-loading"><mat-spinner diameter="40"></mat-spinner></div>
    } @else if (visibleIncidents().length === 0) {
      <div class="rep-empty">
        <mat-icon>verified</mat-icon>
        <h3>No incidents logged for {{ selectedDate | date:'dd MMM yyyy' }}</h3>
        <p>Incidents are recorded automatically while the Controller or Open Map is being monitored.</p>
      </div>
    } @else {
      <div class="rep-table-wrap">
        <table class="rep-table">
          <thead>
            <tr>
              <th>Time</th><th>Type</th><th>Registration</th><th>Driver</th>
              <th>Speed</th><th>Zone / Distance</th><th>Curfew</th><th>Details</th>
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
                <td class="mono strong">{{ i.registration }}</td>
                <td>{{ i.driver || '—' }}</td>
                <td>{{ i.speed ? (i.speed | number:'1.0-0') + ' km/h' : '—' }}</td>
                <td>
                  @if (i.zone) { {{ i.zone }}@if (i.distanceMeters) { <span class="dist"> · {{ i.distanceMeters | number:'1.0-0' }}m out</span> } }
                  @else { — }
                </td>
                <td>
                  <span class="curfew-chip" [class.yes]="i.duringCurfew">{{ i.duringCurfew ? 'Yes' : 'No' }}</span>
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
              <div class="fuel-loading"><mat-spinner diameter="40"></mat-spinner></div>
            } @else if (!flaggedFuelVehicles() || flaggedFuelVehicles().length === 0) {
              <div class="fuel-empty">
                <mat-icon>verified</mat-icon>
                <h3>No vehicles flagged</h3>
                <p>All vehicles have healthy fuel consumption patterns.</p>
              </div>
            } @else {
              <div class="fuel-cards-grid">
                @for (vehicle of flaggedFuelVehicles(); track vehicle.vehicleId) {
                  <div class="fuel-card" [class]="'risk-' + vehicle.riskLevel" (click)="openFuelHealthDetail(vehicle)">
                    <div class="fuel-card-header">
                      <div class="reg-badge">{{ vehicle.registrationNumber }}</div>
                      <span class="risk-badge" [class]="'risk-' + vehicle.riskLevel">
                        @if (vehicle.riskLevel === 'high') { HIGH RISK }
                        @else if (vehicle.riskLevel === 'watch') { WATCH }
                        @else { {{ vehicle.riskLevel | uppercase }} }
                      </span>
                    </div>
                    <div class="fuel-card-content">
                      <div class="metric">
                        <label>Risk Score</label>
                        <span class="value">{{ vehicle.riskScore | number:'1.0-0' }}/100</span>
                      </div>
                      <div class="metric">
                        <label>Flagged Fills</label>
                        <span class="value">{{ vehicle.flaggedFills ?? 0 }}</span>
                      </div>
                      <div class="metric">
                        <label>Est. Litres Lost</label>
                        <span class="value">{{ vehicle.estimatedLitresLost | number:'1.0-0' }}</span>
                      </div>
                    </div>
                    <div class="fuel-card-footer">
                      <span class="reason">{{ vehicle.anomalyReason }}</span>
                      <mat-icon>expand_more</mat-icon>
                    </div>
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
    .reports-wrap { display:flex; flex-direction:column; gap:16px; padding:20px; background:#f8f9fa; border-radius:16px; min-height:70vh; }

    /* Tab styling */
    ::ng-deep .reports-tabs .mat-mdc-tab-header { background: #fff; border-bottom: 1px solid #e5e7eb; border-radius: 10px 10px 0 0; }
    ::ng-deep .reports-tabs .mat-mdc-tab .mdc-tab__text-label { color: #6b7280; }
    ::ng-deep .reports-tabs .mat-mdc-tab-active .mdc-tab__text-label { color: #3f51b5; }
    ::ng-deep .reports-tabs .mat-mdc-tab .mdc-tab__text-label mat-icon { margin-right: 6px; }
    .tab-content { padding: 20px 0; }

    .rep-toolbar { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
    .rep-title { display:flex; align-items:center; gap:12px; }
    .rep-title > mat-icon { font-size:32px; width:32px; height:32px; color:#3f51b5; }
    .rep-title > div { display:flex; flex-direction:column; gap:4px; }
    .rep-title h2 { margin:0; font-size:20px; color:#1a1a2e; }
    .rep-title p { margin:0; font-size:12px; color:#6b7280; }
    .rep-controls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .date-field { width:160px; }
    ::ng-deep .rep-controls .mat-mdc-text-field-wrapper { padding: 0; }

    .rep-summary { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; }
    .sum-card { display:flex; align-items:center; gap:12px; padding:14px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; cursor:pointer; transition:all .2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .sum-card:hover { border-color:#c7d2fe; transform:translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .sum-card.on { background:#eef2ff; border-color:#3f51b5; }
    .sum-card > mat-icon { font-size:24px; width:24px; height:24px; }
    .sum-card.total > mat-icon { color:#3f51b5; }
    .sum-card.speeding > mat-icon { color:#f59e0b; }
    .sum-card.curfew > mat-icon { color:#7c3aed; }
    .sum-card.geofence > mat-icon { color:#dc2626; }
    .sum-card.vehicles > mat-icon { color:#16a34a; }
    .sum-card > div { display:flex; flex-direction:column; gap:2px; }
    .sc-val { font-size:18px; font-weight:600; color:#1a1a2e; }
    .sc-lbl { font-size:11px; color:#6b7280; }

    .rep-loading, .rep-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:60px 20px; }
    .rep-empty > mat-icon { font-size:48px; width:48px; height:48px; color:#86efac; }
    .rep-empty h3 { margin:0; color:#1a1a2e; font-size:18px; }
    .rep-empty p { margin:0; color:#6b7280; font-size:14px; }

    .rep-table-wrap { overflow-x:auto; border-radius:8px; border:1px solid #e5e7eb; background:#fff; }
    .rep-table { width:100%; border-collapse:collapse; font-size:13px; }
    .rep-table thead { background:#f9fafb; }
    .rep-table th { padding:12px 10px; text-align:left; color:#3f51b5; font-weight:600; white-space:nowrap; border-bottom:1px solid #e5e7eb; }
    .rep-table tbody tr { border-bottom:1px solid #f0f1f3; }
    .rep-table tbody tr:hover { background:#f5f7ff; }
    .rep-table td { padding:12px 10px; color:#374151; }
    .rep-table .mono { font-family:monospace; font-size:12px; }
    .rep-table .strong { font-weight:600; color:#1a1a2e; }
    .type-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:6px; font-size:12px; font-weight:600; }
    .type-badge > mat-icon { font-size:14px; width:14px; height:14px; }
    .t-Speeding { background:#fef3c7; color:#b45309; }
    .t-CurfewMovement { background:#ede9fe; color:#6d28d9; }
    .t-GeofenceExit { background:#fee2e2; color:#b91c1c; }
    .curfew-chip { padding:2px 10px; border-radius:10px; font-size:11px; font-weight:600; background:#f1f5f9; color:#64748b; }
    .curfew-chip.yes { background:#fee2e2; color:#b91c1c; }
    .dist { color:#9ca3af; font-size:11px; }

    /* Fuel Health Section */
    .fuel-health-section { display:flex; flex-direction:column; gap:20px; }
    .fuel-title { display:flex; align-items:center; gap:12px; }
    .fuel-title > mat-icon { font-size:32px; width:32px; height:32px; color:#f97316; }
    .fuel-title > div { display:flex; flex-direction:column; gap:4px; }
    .fuel-title h2 { margin:0; font-size:20px; color:#1a1a2e; }
    .fuel-title p { margin:0; font-size:12px; color:#6b7280; }
    .fuel-controls { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
    ::ng-deep .fuel-controls .mat-mdc-form-field { width: 140px; }
    .fuel-loading, .fuel-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:60px 20px; }
    .fuel-empty > mat-icon { font-size:48px; width:48px; height:48px; color:#86efac; }
    .fuel-empty h3 { margin:0; color:#1a1a2e; font-size:18px; }
    .fuel-empty p { margin:0; color:#6b7280; font-size:14px; }

    .fuel-cards-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px; }
    .fuel-card { display:flex; flex-direction:column; padding:16px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; cursor:pointer; transition:all .2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .fuel-card:hover { transform:translateY(-4px); border-color:#c7d2fe; box-shadow: 0 6px 20px rgba(0,0,0,0.10); }
    .fuel-card.risk-high { border-left:4px solid #ef4444; }
    .fuel-card.risk-watch { border-left:4px solid #f97316; }
    .fuel-card.risk-normal { border-left:4px solid #22c55e; }

    .fuel-card-header { display:flex; justify-content:space-between; align-items:start; gap:8px; margin-bottom:12px; }
    .reg-badge { padding:4px 10px; background:#eef2ff; color:#3f51b5; border-radius:4px; font-weight:600; font-size:14px; }
    .risk-badge { padding:4px 10px; border-radius:4px; font-size:11px; font-weight:700; }
    .risk-badge.risk-high { background:#fee2e2; color:#b91c1c; }
    .risk-badge.risk-watch { background:#ffedd5; color:#c2410c; }
    .risk-badge.risk-normal { background:#dcfce7; color:#15803d; }

    .fuel-card-content { display:flex; flex-direction:column; gap:10px; margin-bottom:12px; }
    .metric { display:flex; justify-content:space-between; align-items:center; }
    .metric > label { font-size:12px; color:#6b7280; }
    .metric > .value { font-weight:600; font-size:14px; color:#1a1a2e; }

    .fuel-card-footer { display:flex; justify-content:space-between; align-items:center; padding-top:10px; border-top:1px solid #f0f1f3; }
    .reason { font-size:12px; color:#6b7280; flex:1; }
    .fuel-card-footer > mat-icon { font-size:18px; width:18px; height:18px; color:#9ca3af; }
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

  constructor(private http: HttpClient, private snack: MatSnackBar) {}

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
        this.snack.open('Incident report exported', 'Close', { duration: 2500 });
      },
      error: () => this.snack.open('Failed to export report', 'Close', { duration: 3000 })
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
          const flagged = (res.vehicles || []).filter((v: any) => v.riskLevel === 'high' || v.riskLevel === 'watch');
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
      this.snack.open('No flagged vehicles to export', 'Close', { duration: 2500 });
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
        this.snack.open(`Exported ${vehicles.length} flagged vehicle(s)`, 'Close', { duration: 2500 });
      },
      error: () => this.snack.open('Failed to export fuel health report', 'Close', { duration: 3000 })
    });
  }

  openFuelHealthDetail(vehicle: any): void {
    // Could open a detailed dialog for individual vehicle analysis
    this.snack.open(`Viewing fuel health for ${vehicle.registrationNumber}`, 'Close', { duration: 2500 });
  }
}
