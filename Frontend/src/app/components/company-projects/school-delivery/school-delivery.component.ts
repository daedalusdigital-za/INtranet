import { Component, OnInit, Output, EventEmitter, Inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  SchoolDeliveryService, ProvinceTheme, SdmStatus
} from '../../../services/school-delivery.service';

@Component({
  selector: 'app-school-delivery',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DecimalPipe,
    MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule, MatTabsModule, MatChipsModule, MatSnackBarModule,
    MatDialogModule
  ],
  template: `
    <div class="sdm-wrap" [style.--sdm-primary]="activeProvince?.primary || '#1e3a8a'"
         [style.--sdm-accent]="activeProvince?.accent || '#3b82f6'">

      <!-- Header -->
      <div class="sdm-hero" [style.background]="activeProvince?.gradient || 'linear-gradient(135deg,#1e3a8a,#3b82f6)'">
        <button mat-button class="back-btn" (click)="onBack()">
          <mat-icon>arrow_back</mat-icon> {{ activeProvince ? 'Provinces' : 'Back' }}
        </button>
        <div class="hero-title">
          <div class="hero-icon"><mat-icon>{{ activeProvince?.icon || 'school' }}</mat-icon></div>
          <div>
            <h1>School Delivery Management</h1>
            <p>Sanitary Pads Dignity Programme{{ activeProvince ? ' — ' + activeProvince.name : '' }}</p>
          </div>
        </div>
        @if (activeProvince) {
          <button mat-flat-button class="refresh-btn" (click)="loadDashboard()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        }
      </div>

      <!-- Province selection -->
      @if (!activeProvince) {
        <div class="province-grid">
          @for (p of svc.provinces; track p.code) {
            <div class="province-card" [style.background]="p.gradient" (click)="selectProvince(p)">
              <div class="pc-icon"><mat-icon>{{ p.icon }}</mat-icon></div>
              <h2>{{ p.name }}</h2>
              <div class="pc-status">
                @if (statusMap[p.code]) {
                  <span class="dot" [class.ok]="statusMap[p.code].reachable"
                        [class.bad]="!statusMap[p.code].reachable"></span>
                  <span>{{ statusMap[p.code].reachable ? 'Online' : 'Offline' }}</span>
                  @if (statusMap[p.code].reachable && !statusMap[p.code].authenticated) {
                    <span class="warn-pill" matTooltip="{{ statusMap[p.code].message }}">No credentials</span>
                  }
                } @else {
                  <span class="dot"></span><span>Checking…</span>
                }
              </div>
              <div class="pc-stats">
                <div><strong>{{ p.districts }}</strong><span>Districts</span></div>
                <div><strong>{{ p.schools | number }}</strong><span>Schools</span></div>
                <div><strong>{{ p.girlsPerMonth | number }}</strong><span>Girls/month</span></div>
              </div>
              <button mat-flat-button class="enter-btn">
                <mat-icon>login</mat-icon> Sign in &amp; Manage
              </button>
            </div>
          }
        </div>
        <p class="hint">
          <mat-icon>info</mat-icon>
          Select a province and sign in with that region's credentials to view live data.
        </p>
      }

      <!-- Province dashboard -->
      @if (activeProvince) {
        @if (!connected) {
          <div class="notice">
            <mat-icon>{{ reachable ? 'lock' : 'cloud_off' }}</mat-icon>
            <div class="notice-body">
              <h3>{{ reachable ? 'Sign in required' : (activeProvince.name + ' API unreachable') }}</h3>
              <p>{{ statusMessage }}</p>
            </div>
            @if (reachable) {
              <button mat-flat-button class="signin-btn" (click)="openLogin()">
                <mat-icon>login</mat-icon> Sign in
              </button>
            }
          </div>
        } @else {
          <div class="notice ok">
            <mat-icon>verified_user</mat-icon>
            <div class="notice-body">
              <h3>Connected to {{ activeProvince.name }}</h3>
              <p>Live data is active for this session.</p>
            </div>
            <button mat-stroked-button class="signout-btn" (click)="signOut()">
              <mat-icon>logout</mat-icon> Sign out
            </button>
          </div>
        }

        <!-- Stat cards -->
        <div class="stat-cards">
          <div class="stat-card">
            <div class="sc-icon"><mat-icon>local_shipping</mat-icon></div>
            <div class="sc-body"><span class="sc-num">{{ stats.activeDeliveries | number }}</span><span class="sc-label">Active Deliveries</span></div>
          </div>
          <div class="stat-card">
            <div class="sc-icon green"><mat-icon>task_alt</mat-icon></div>
            <div class="sc-body"><span class="sc-num">{{ stats.completed | number }}</span><span class="sc-label">Completed</span></div>
          </div>
          <div class="stat-card">
            <div class="sc-icon amber"><mat-icon>pending_actions</mat-icon></div>
            <div class="sc-body"><span class="sc-num">{{ stats.pending | number }}</span><span class="sc-label">Pending</span></div>
          </div>
          <div class="stat-card">
            <div class="sc-icon red"><mat-icon>warning</mat-icon></div>
            <div class="sc-body"><span class="sc-num">{{ stats.delayed | number }}</span><span class="sc-label">Delayed</span></div>
          </div>
          <div class="stat-card wide">
            <div class="sc-icon accent"><mat-icon>female</mat-icon></div>
            <div class="sc-body"><span class="sc-num">{{ activeProvince.girlsPerMonth | number }}</span><span class="sc-label">Girls Benefited / Month</span></div>
          </div>
          <div class="stat-card">
            <div class="sc-icon"><mat-icon>school</mat-icon></div>
            <div class="sc-body"><span class="sc-num">{{ stats.schools || activeProvince.schools | number }}</span><span class="sc-label">Schools</span></div>
          </div>
        </div>

        <mat-tab-group class="sdm-tabs" [style.--sdm-primary]="activeProvince.primary">
          <!-- Deliveries -->
          <mat-tab label="Deliveries">
            @if (loadingDeliveries) { <div class="loading"><mat-spinner diameter="36"></mat-spinner></div> }
            @else if (deliveries.length === 0) {
              <div class="empty"><mat-icon>inbox</mat-icon><p>No delivery data available</p></div>
            } @else {
              <div class="table-wrap">
                <table class="sdm-table">
                  <thead><tr><th>Tracking #</th><th>School</th><th>District</th><th>Status</th><th>Priority</th><th>Date</th></tr></thead>
                  <tbody>
                    @for (d of deliveries; track $index) {
                      <tr>
                        <td>{{ pick(d, ['trackingNumber','tracking','id']) }}</td>
                        <td>{{ pick(d, ['schoolName','school']) }}</td>
                        <td>{{ pick(d, ['district']) }}</td>
                        <td><span class="badge" [class]="statusClass(pick(d, ['status']))">{{ pick(d, ['status']) }}</span></td>
                        <td>{{ pick(d, ['priority']) }}</td>
                        <td>{{ pick(d, ['deliveryDate','date']) | slice:0:10 }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </mat-tab>

          <!-- Schools -->
          <mat-tab label="Schools">
            @if (loadingSchools) { <div class="loading"><mat-spinner diameter="36"></mat-spinner></div> }
            @else if (schools.length === 0) {
              <div class="empty"><mat-icon>domain</mat-icon><p>No school data available</p></div>
            } @else {
              <div class="table-wrap">
                <table class="sdm-table">
                  <thead><tr><th>EMIS</th><th>School Name</th><th>District</th><th>Students</th><th>Quintile</th><th>Status</th></tr></thead>
                  <tbody>
                    @for (s of schools; track $index) {
                      <tr>
                        <td>{{ pick(s, ['emisNumber','emis']) }}</td>
                        <td>{{ pick(s, ['schoolName','name']) }}</td>
                        <td>{{ pick(s, ['district']) }}</td>
                        <td>{{ pick(s, ['totalStudents','students']) | number }}</td>
                        <td>{{ pick(s, ['quintile']) }}</td>
                        <td><span class="badge" [class]="statusClass(pick(s, ['status']))">{{ pick(s, ['status']) }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
                <p class="table-note">Showing {{ schools.length }} of {{ activeProvince.schools | number }} schools</p>
              </div>
            }
          </mat-tab>
        </mat-tab-group>
      }
    </div>
  `,
  styles: [`
    .sdm-wrap { padding-bottom: 40px; }
    .sdm-hero {
      display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
      padding: 24px 28px; border-radius: 18px; color: #fff; margin-bottom: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .back-btn { color: #fff !important; background: rgba(255,255,255,0.15) !important; }
    .refresh-btn { color: #fff !important; background: rgba(255,255,255,0.2) !important; margin-left: auto; }
    .hero-title { display: flex; align-items: center; gap: 16px; }
    .hero-icon {
      width: 56px; height: 56px; border-radius: 50%; background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
    }
    .hero-icon mat-icon { font-size: 30px; width: 30px; height: 30px; }
    .hero-title h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .hero-title p { margin: 2px 0 0; opacity: 0.9; font-size: 14px; }

    .province-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;
    }
    .province-card {
      border-radius: 18px; padding: 28px; color: #fff; cursor: pointer;
      box-shadow: 0 8px 28px rgba(0,0,0,0.22); transition: transform 0.25s, box-shadow 0.25s;
      display: flex; flex-direction: column; gap: 14px;
    }
    .province-card:hover { transform: translateY(-6px); box-shadow: 0 16px 44px rgba(0,0,0,0.3); }
    .pc-icon {
      width: 60px; height: 60px; border-radius: 16px; background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
    }
    .pc-icon mat-icon { font-size: 34px; width: 34px; height: 34px; }
    .province-card h2 { margin: 0; font-size: 22px; font-weight: 700; }
    .pc-status { display: flex; align-items: center; gap: 8px; font-size: 13px; opacity: 0.95; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #cbd5e1; display: inline-block; }
    .dot.ok { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
    .dot.bad { background: #ef4444; }
    .warn-pill { background: rgba(255,255,255,0.25); padding: 2px 8px; border-radius: 10px; font-size: 11px; }
    .pc-stats { display: flex; gap: 18px; margin-top: 4px; }
    .pc-stats div { display: flex; flex-direction: column; }
    .pc-stats strong { font-size: 18px; }
    .pc-stats span { font-size: 11px; opacity: 0.85; }
    .enter-btn { background: rgba(255,255,255,0.9) !important; color: #111 !important; margin-top: 8px; align-self: flex-start; }
    .hint {
      display: flex; align-items: center; gap: 8px; justify-content: center;
      margin-top: 24px; color: #64748b; font-size: 13px;
    }
    .hint mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .notice {
      display: flex; align-items: center; gap: 16px; background: #fff7ed; border: 1px solid #fed7aa;
      border-radius: 14px; padding: 16px 20px; margin-bottom: 20px;
    }
    .notice mat-icon { color: #ea580c; font-size: 32px; width: 32px; height: 32px; }
    .notice h3 { margin: 0; color: #9a3412; font-size: 16px; }
    .notice p { margin: 4px 0 0; color: #7c2d12; font-size: 13px; }
    .notice-body { flex: 1; }
    .notice.ok { background: #f0fdf4; border-color: #bbf7d0; }
    .notice.ok mat-icon { color: #16a34a; }
    .notice.ok h3 { color: #166534; }
    .notice.ok p { color: #15803d; }
    .signin-btn { background: #ea580c !important; color: #fff !important; }
    .signout-btn { color: #166534 !important; border-color: #86efac !important; }

    .stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card {
      background: #fff; border-radius: 14px; padding: 18px; display: flex; align-items: center; gap: 14px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-left: 4px solid var(--sdm-primary);
    }
    .stat-card.wide { grid-column: span 2; }
    .sc-icon {
      width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
      background: rgba(30,58,138,0.1); color: var(--sdm-primary);
    }
    .sc-icon.green { background: rgba(34,197,94,0.12); color: #16a34a; }
    .sc-icon.amber { background: rgba(245,158,11,0.14); color: #d97706; }
    .sc-icon.red { background: rgba(239,68,68,0.12); color: #dc2626; }
    .sc-icon.accent { background: rgba(0,0,0,0.05); color: var(--sdm-accent); }
    .sc-body { display: flex; flex-direction: column; }
    .sc-num { font-size: 24px; font-weight: 700; color: #0f172a; }
    .sc-label { font-size: 12px; color: #64748b; }

    .sdm-tabs { background: #fff; border-radius: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); overflow: hidden; }
    .loading, .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; color: #94a3b8; gap: 8px; }
    .empty mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .table-wrap { padding: 8px 4px 16px; overflow-x: auto; }
    .sdm-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .sdm-table th { text-align: left; padding: 12px 16px; color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #f1f5f9; }
    .sdm-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .sdm-table tr:hover td { background: #f8fafc; }
    .badge { padding: 3px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; background: #e2e8f0; color: #475569; }
    .badge.ok { background: #dcfce7; color: #166534; }
    .badge.warn { background: #fef3c7; color: #92400e; }
    .badge.bad { background: #fee2e2; color: #991b1b; }
    .badge.info { background: #dbeafe; color: #1e40af; }
    .table-note { padding: 8px 16px; color: #94a3b8; font-size: 12px; }
  `]
})
export class SchoolDeliveryComponent implements OnInit {
  @Output() goBack = new EventEmitter<void>();

  activeProvince: ProvinceTheme | null = null;
  statusMap: Record<string, SdmStatus> = {};

  connected = false;
  reachable = false;
  statusMessage = '';

  stats = { activeDeliveries: 0, completed: 0, pending: 0, delayed: 0, schools: 0 };
  deliveries: any[] = [];
  schools: any[] = [];
  loadingDeliveries = false;
  loadingSchools = false;

  constructor(public svc: SchoolDeliveryService, private snack: MatSnackBar, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.svc.getStatus().subscribe({
      next: (list) => list.forEach(s => this.statusMap[s.regionCode] = s),
      error: () => {}
    });
  }

  selectProvince(p: ProvinceTheme): void {
    const alreadyAuthed = this.statusMap[p.code]?.authenticated === true;
    if (alreadyAuthed) {
      // Already have a valid session — open the page straight away
      this.openProvince(p);
      return;
    }
    // Prompt for credentials first. The province page only opens once the
    // login + token + data-check sequence completes successfully.
    this.openLogin(p);
  }

  private openProvince(p: ProvinceTheme): void {
    this.activeProvince = p;
    this.connected = false;
    this.reachable = this.statusMap[p.code]?.reachable ?? false;
    this.statusMessage = this.statusMap[p.code]?.message ?? '';
    this.loadDashboard();
  }

  onBack(): void {
    if (this.activeProvince) {
      this.activeProvince = null;
    } else {
      this.goBack.emit();
    }
  }

  openLogin(province?: ProvinceTheme): void {
    const target = province || this.activeProvince;
    if (!target) return;
    const ref = this.dialog.open(SdmLoginDialogComponent, {
      width: '440px',
      maxWidth: '94vw',
      panelClass: 'sdm-login-panel',
      autoFocus: false,
      disableClose: true,
      data: { province: target }
    });
    ref.afterClosed().subscribe((ok: boolean) => {
      if (ok) {
        // Login + token + data-readiness already confirmed inside the dialog.
        this.snack.open(`Signed in to ${target.name}`, 'OK', { duration: 2500 });
        this.openProvince(target);
      }
      // If cancelled, stay on the province selection screen (page not opened).
    });
  }

  signOut(): void {
    if (!this.activeProvince) return;
    const region = this.activeProvince.code;
    this.svc.logout(region).subscribe({
      next: () => {
        this.connected = false;
        this.snack.open('Signed out', 'OK', { duration: 2000 });
        this.loadDashboard();
      },
      error: () => { this.connected = false; }
    });
  }

  loadDashboard(): void {
    if (!this.activeProvince) return;
    const region = this.activeProvince.code;

    // First confirm the connection/auth status; only fetch data if authenticated.
    this.svc.getRegionStatus(region).subscribe({
      next: (s) => {
        this.statusMap[region] = s;
        this.reachable = s.reachable;
        this.connected = s.authenticated;
        this.statusMessage = s.message || '';
        if (s.authenticated) {
          this.loadData(region);
        } else {
          // Not authenticated — clear any stale data, don't fire proxied calls
          this.stats = { activeDeliveries: 0, completed: 0, pending: 0, delayed: 0, schools: 0 };
          this.deliveries = [];
          this.schools = [];
        }
      },
      error: () => {
        this.connected = false;
        this.reachable = false;
        this.statusMessage = 'Unable to reach the region service.';
      }
    });
  }

  private loadData(region: string): void {
    // Statistics (best-effort mapping from upstream payload)
    this.svc.getStatistics(region).subscribe({
      next: (res) => {
        const d = res?.data;
        this.stats.activeDeliveries = this.svc.pickNumber(d, ['active', 'activeDeliveries', 'inProgress']);
        this.stats.completed = this.svc.pickNumber(d, ['completed', 'delivered', 'completedToday']);
        this.stats.pending = this.svc.pickNumber(d, ['pending', 'scheduled']);
        this.stats.delayed = this.svc.pickNumber(d, ['delayed', 'overdue', 'failed']);
      },
      error: () => {}
    });

    this.svc.getSchoolStatistics(region).subscribe({
      next: (res) => { this.stats.schools = this.svc.pickNumber(res?.data, ['total', 'totalSchools', 'count']); },
      error: () => {}
    });

    // Deliveries
    this.loadingDeliveries = true;
    this.svc.getDeliveries(region).subscribe({
      next: (res) => { this.deliveries = this.svc.asArray(res?.data).slice(0, 100); this.loadingDeliveries = false; },
      error: () => { this.deliveries = []; this.loadingDeliveries = false; }
    });

    // Schools
    this.loadingSchools = true;
    this.svc.getSchools(region).subscribe({
      next: (res) => { this.schools = this.svc.asArray(res?.data).slice(0, 100); this.loadingSchools = false; },
      error: () => { this.schools = []; this.loadingSchools = false; }
    });
  }

  pick(obj: any, keys: string[]): any {
    if (!obj) return '';
    for (const k of keys) {
      const match = Object.keys(obj).find(ok => ok.toLowerCase() === k.toLowerCase());
      if (match && obj[match] != null && obj[match] !== '') return obj[match];
    }
    return '';
  }

  statusClass(status: any): string {
    const s = (status || '').toString().toLowerCase();
    if (/(deliver|complete|active|done|open)/.test(s)) return 'ok';
    if (/(pending|schedul|progress)/.test(s)) return 'info';
    if (/(delay|overdue|hold|warn)/.test(s)) return 'warn';
    if (/(fail|cancel|closed|inactive)/.test(s)) return 'bad';
    return '';
  }
}

// ---------------------------------------------------------------------------
// Login dialog — prompts for email + password to authenticate to a region
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-sdm-login-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="sdm-login" [style.--sdm-primary]="data.province.primary"
         [style.--sdm-accent]="data.province.accent">
      <!-- Decorative header -->
      <div class="dlg-hero" [style.background]="data.province.gradient">
        <div class="hero-glow"></div>
        <button mat-icon-button class="close-x" (click)="ref.close(false)" [disabled]="loading" tabindex="-1">
          <mat-icon>close</mat-icon>
        </button>
        <div class="hero-badge"><mat-icon>{{ data.province.icon }}</mat-icon></div>
        <h2>{{ data.province.name }}</h2>
        <p>School Delivery Management</p>
      </div>

      <div class="dlg-body">
        @if (!loading) {
        <div class="welcome">
          <h3>Welcome back</h3>
          <p>Sign in with your {{ data.province.name }} SDM account to load live delivery data.</p>
        </div>

        <label class="field-label">Email address</label>
        <div class="field" [class.focused]="focus === 'email'" [class.filled]="email">
          <mat-icon>mail_outline</mat-icon>
          <input type="email" [(ngModel)]="email" autocomplete="username"
                 (focus)="focus = 'email'" (blur)="focus = ''"
                 (keyup.enter)="submit()" placeholder="you@example.gov.za">
        </div>

        <label class="field-label">Password</label>
        <div class="field" [class.focused]="focus === 'pw'" [class.filled]="password">
          <mat-icon>lock_outline</mat-icon>
          <input [type]="showPw ? 'text' : 'password'" [(ngModel)]="password"
                 autocomplete="current-password"
                 (focus)="focus = 'pw'" (blur)="focus = ''"
                 (keyup.enter)="submit()" placeholder="••••••••">
          <button type="button" class="eye" (click)="showPw = !showPw" tabindex="-1">
            <mat-icon>{{ showPw ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
        </div>

        @if (error) {
          <div class="dlg-error"><mat-icon>error_outline</mat-icon><span>{{ error }}</span></div>
        }

        <button class="go-btn" (click)="submit()" [disabled]="!email || !password">
          <mat-icon>login</mat-icon>
          <span>Sign in</span>
        </button>

        <p class="secure-note"><mat-icon>verified_user</mat-icon> Credentials are used only to obtain a secure access token.</p>
        } @else {
        <!-- Progress sequence -->
        <div class="progress-panel">
          <div class="progress-track">
            <div class="progress-fill" [style.width.%]="progressPercent"></div>
          </div>

          <div class="steps">
            @for (s of steps; track s.key) {
              <div class="step" [class.done]="s.state === 'done'"
                   [class.active]="s.state === 'active'"
                   [class.failed]="s.state === 'failed'">
                <div class="step-icon">
                  @if (s.state === 'done') { <mat-icon>check</mat-icon> }
                  @else if (s.state === 'active') { <mat-spinner diameter="18" strokeWidth="2.5"></mat-spinner> }
                  @else if (s.state === 'failed') { <mat-icon>close</mat-icon> }
                  @else { <span class="dot-idle"></span> }
                </div>
                <span class="step-label">{{ s.label }}</span>
              </div>
            }
          </div>

          @if (error) {
            <div class="dlg-error"><mat-icon>error_outline</mat-icon><span>{{ error }}</span></div>
            <button class="retry-btn" (click)="reset()">
              <mat-icon>refresh</mat-icon> Try again
            </button>
          } @else {
            <p class="progress-hint">Please wait while we connect you to {{ data.province.name }}…</p>
          }
        </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .sdm-login { position: relative; }

    .dlg-hero {
      position: relative; overflow: hidden;
      padding: 34px 32px 30px; color: #fff; text-align: center;
      margin: 0;
    }
    .hero-glow {
      position: absolute; top: -60px; right: -40px; width: 180px; height: 180px;
      background: rgba(255,255,255,0.18); border-radius: 50%; filter: blur(10px);
    }
    .close-x {
      position: absolute; top: 8px; right: 8px; color: rgba(255,255,255,0.85) !important; z-index: 2;
    }
    .hero-badge {
      width: 68px; height: 68px; border-radius: 20px; margin: 0 auto 14px;
      background: rgba(255,255,255,0.22); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18); position: relative; z-index: 1;
    }
    .hero-badge mat-icon { font-size: 38px; width: 38px; height: 38px; }
    .dlg-hero h2 { margin: 0; font-size: 23px; font-weight: 800; letter-spacing: -0.3px; position: relative; z-index: 1; }
    .dlg-hero p { margin: 4px 0 0; font-size: 13px; opacity: 0.9; position: relative; z-index: 1; }

    .dlg-body { padding: 26px 30px 24px; }
    .welcome { text-align: center; margin-bottom: 24px; }
    .welcome h3 { margin: 0; font-size: 20px; font-weight: 700; color: #0f172a; }
    .welcome p { margin: 6px auto 0; font-size: 13.5px; color: #64748b; max-width: 320px; line-height: 1.5; }

    .field-label {
      display: block; font-size: 12.5px; font-weight: 600; color: #475569;
      margin: 0 0 8px 2px; letter-spacing: 0.2px;
    }
    .field {
      display: flex; align-items: center; gap: 12px;
      background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 14px;
      padding: 0 16px; height: 54px; margin-bottom: 18px;
      transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    }
    .field.focused {
      border-color: var(--sdm-primary); background: #fff;
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--sdm-primary) 12%, transparent);
    }
    .field > mat-icon { color: #94a3b8; font-size: 22px; width: 22px; height: 22px; transition: color 0.2s; }
    .field.focused > mat-icon { color: var(--sdm-primary); }
    .field input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 15px; color: #0f172a; height: 100%;
    }
    .field input::placeholder { color: #cbd5e1; }
    .eye {
      border: none; background: transparent; cursor: pointer; color: #94a3b8;
      display: flex; align-items: center; padding: 4px; border-radius: 8px;
    }
    .eye:hover { color: #475569; background: #eef2f7; }

    .dlg-error {
      display: flex; align-items: center; gap: 10px; background: #fef2f2; color: #b91c1c;
      border: 1px solid #fecaca; border-radius: 12px; padding: 12px 14px; font-size: 13.5px;
      margin: 2px 0 18px;
    }
    .dlg-error mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }

    .go-btn {
      width: 100%; height: 54px; border: none; border-radius: 14px; cursor: pointer;
      background: linear-gradient(135deg, var(--sdm-primary), var(--sdm-accent));
      color: #fff; font-size: 15.5px; font-weight: 700; letter-spacing: 0.3px;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      box-shadow: 0 8px 22px color-mix(in srgb, var(--sdm-primary) 40%, transparent);
      transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
    }
    .go-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 30px color-mix(in srgb, var(--sdm-primary) 50%, transparent); }
    .go-btn:active:not(:disabled) { transform: translateY(0); }
    .go-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .go-btn mat-spinner { --mdc-circular-progress-active-indicator-color: #fff; }
    .go-btn ::ng-deep circle { stroke: #fff !important; }

    .secure-note {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      margin: 18px 0 0; font-size: 12px; color: #94a3b8; text-align: center;
    }
    .secure-note mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* Progress sequence */
    .progress-panel { padding: 8px 0 4px; }
    .progress-track {
      height: 8px; background: #eef2f7; border-radius: 999px; overflow: hidden; margin-bottom: 24px;
    }
    .progress-fill {
      height: 100%; border-radius: 999px; transition: width 0.5s cubic-bezier(0.4,0,0.2,1);
      background: linear-gradient(90deg, var(--sdm-primary), var(--sdm-accent));
    }
    .steps { display: flex; flex-direction: column; gap: 6px; }
    .step {
      display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 12px;
      transition: background 0.3s; opacity: 0.5;
    }
    .step.active { background: color-mix(in srgb, var(--sdm-primary) 8%, transparent); opacity: 1; }
    .step.done { opacity: 1; }
    .step.failed { opacity: 1; background: #fef2f2; }
    .step-icon {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: #eef2f7; color: #94a3b8; transition: background 0.3s, color 0.3s;
    }
    .step.active .step-icon { background: color-mix(in srgb, var(--sdm-primary) 15%, #fff); }
    .step.done .step-icon { background: #dcfce7; color: #16a34a; }
    .step.failed .step-icon { background: #fee2e2; color: #dc2626; }
    .step-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .step-icon .dot-idle { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; }
    .step-label { font-size: 14.5px; font-weight: 600; color: #334155; }
    .step.active .step-label { color: var(--sdm-primary); }

    .progress-hint { text-align: center; color: #94a3b8; font-size: 13px; margin: 22px 0 4px; }
    .retry-btn {
      width: 100%; height: 48px; margin-top: 18px; border: 2px solid #e2e8f0; border-radius: 12px;
      background: #fff; color: #334155; font-size: 14.5px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .retry-btn:hover { background: #f8fafc; border-color: #cbd5e1; }
  `]
})
export class SdmLoginDialogComponent {
  email = '';
  password = '';
  showPw = false;
  loading = false;
  error = '';
  focus = '';

  steps: { key: string; label: string; state: 'idle' | 'active' | 'done' | 'failed' }[] = [
    { key: 'auth', label: 'Authenticating credentials', state: 'idle' },
    { key: 'token', label: 'Obtaining secure access token', state: 'idle' },
    { key: 'data', label: 'Loading live delivery data', state: 'idle' }
  ];

  get progressPercent(): number {
    const done = this.steps.filter(s => s.state === 'done').length;
    const active = this.steps.some(s => s.state === 'active') ? 0.5 : 0;
    return Math.round(((done + active) / this.steps.length) * 100);
  }

  constructor(
    public ref: MatDialogRef<SdmLoginDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { province: ProvinceTheme },
    private svc: SchoolDeliveryService
  ) {}

  private setStep(key: string, state: 'idle' | 'active' | 'done' | 'failed'): void {
    const s = this.steps.find(x => x.key === key);
    if (s) s.state = state;
  }

  reset(): void {
    this.loading = false;
    this.error = '';
    this.steps.forEach(s => s.state = 'idle');
  }

  submit(): void {
    if (!this.email || !this.password || this.loading) return;
    this.loading = true;
    this.error = '';
    this.steps.forEach(s => s.state = 'idle');
    const region = this.data.province.code;

    // Step 1 + 2: authenticate & obtain token (single backend login call)
    this.setStep('auth', 'active');
    this.svc.login(region, this.email.trim(), this.password).subscribe({
      next: (res) => {
        if (!res.success) {
          // Wrong SDM credentials — the backend returns 200 with success:false
          this.setStep('auth', 'failed');
          this.error = res.error || 'Sign in failed. Please check your email and password.';
          this.loading = false;
          return;
        }
        this.setStep('auth', 'done');
        this.setStep('token', 'active');
        // Give the token step a brief visible moment, then verify + load data
        setTimeout(() => {
          this.setStep('token', 'done');
          this.setStep('data', 'active');
          this.svc.getRegionStatus(region).subscribe({
            next: (s) => {
              if (s.authenticated) {
                this.setStep('data', 'done');
                // Short pause so the user sees all three ticks complete
                setTimeout(() => this.ref.close(true), 500);
              } else {
                this.setStep('data', 'failed');
                this.error = s.message || 'Signed in, but the session could not be verified.';
                this.loading = false;
              }
            },
            error: () => {
              this.setStep('data', 'failed');
              this.error = 'Could not load data for this province. Please try again.';
              this.loading = false;
            }
          });
        }, 450);
      },
      error: (err) => {
        this.setStep('auth', 'failed');
        this.error = err?.error?.error || 'Sign in failed. Please check your email and password.';
        this.loading = false;
      }
    });
  }
}
