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
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  SchoolDeliveryService, ProvinceTheme, SdmStatus
} from '../../../services/school-delivery.service';
import { ToastService } from '../../../ui/toast.service';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../../ui/empty-state/empty-state.component';
import { StatusChipComponent, ChipTone } from '../../../ui/status-chip/status-chip.component';

@Component({
  selector: 'app-school-delivery',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DecimalPipe,
    MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule, MatTabsModule, MatChipsModule,
    MatDialogModule, SkeletonRowsComponent, EmptyStateComponent, StatusChipComponent
  ],
  template: `
    <div class="sdm-wrap">

      <!-- Header -->
      <div class="sdm-hero">
        <button mat-stroked-button class="back-btn" (click)="onBack()">
          <mat-icon>arrow_back</mat-icon> {{ activeProvince ? 'Provinces' : 'Back' }}
        </button>
        <div class="hero-title">
          <div class="hero-icon"><mat-icon>{{ activeProvince?.icon || 'school' }}</mat-icon></div>
          <div>
            <h2>School Delivery Management</h2>
            <p>Sanitary Pads Dignity Programme{{ activeProvince ? ' — ' + activeProvince.name : '' }}</p>
          </div>
        </div>
        @if (activeProvince) {
          <button mat-stroked-button class="refresh-btn" (click)="loadDashboard()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        }
      </div>

      <!-- Province selection -->
      @if (!activeProvince) {
        <div class="province-grid">
          @for (p of svc.provinces; track p.code) {
            <div class="province-card" (click)="selectProvince(p)">
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
              <button mat-stroked-button class="enter-btn">
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
              <button mat-flat-button color="primary" class="signin-btn" (click)="openLogin()">
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

        <mat-tab-group class="sdm-tabs">
          <!-- Deliveries -->
          <mat-tab label="Deliveries">
            @if (loadingDeliveries) { <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows> }
            @else if (deliveries.length === 0) {
              <app-empty-state icon="inbox" title="No deliveries to show"
                               [message]="connected ? 'The ' + activeProvince.name + ' system has no deliveries on record for this region.' : 'Sign in to ' + activeProvince.name + ' to load its live delivery data.'">
                @if (!connected && reachable) {
                  <button mat-stroked-button (click)="openLogin()"><mat-icon>login</mat-icon> Sign in</button>
                }
              </app-empty-state>
            } @else {
              <div class="table-wrap">
                <table class="app-table">
                  <thead><tr><th>Tracking #</th><th>School</th><th>District</th><th>Status</th><th>Priority</th><th>Date</th></tr></thead>
                  <tbody>
                    @for (d of deliveries; track $index) {
                      <tr>
                        <td class="ref">{{ pick(d, ['trackingNumber','tracking','id']) }}</td>
                        <td>{{ pick(d, ['schoolName','school']) }}</td>
                        <td>{{ pick(d, ['district']) }}</td>
                        <td>@if (pick(d, ['status'])) { <app-status-chip [status]="pick(d, ['status'])" [tone]="chipTone(pick(d, ['status']))"></app-status-chip> }</td>
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
            @if (loadingSchools) { <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows> }
            @else if (schools.length === 0) {
              <app-empty-state icon="domain" title="No schools to show"
                               [message]="connected ? 'The ' + activeProvince.name + ' system has no schools on record for this region.' : 'Sign in to ' + activeProvince.name + ' to load its school list.'">
                @if (!connected && reachable) {
                  <button mat-stroked-button (click)="openLogin()"><mat-icon>login</mat-icon> Sign in</button>
                }
              </app-empty-state>
            } @else {
              <div class="table-wrap">
                <table class="app-table">
                  <thead><tr><th>EMIS</th><th>School Name</th><th>District</th><th class="num">Students</th><th>Quintile</th><th>Status</th></tr></thead>
                  <tbody>
                    @for (s of schools; track $index) {
                      <tr>
                        <td class="ref">{{ pick(s, ['emisNumber','emis']) }}</td>
                        <td>{{ pick(s, ['schoolName','name']) }}</td>
                        <td>{{ pick(s, ['district']) }}</td>
                        <td class="num">{{ pick(s, ['totalStudents','students']) | number }}</td>
                        <td>{{ pick(s, ['quintile']) }}</td>
                        <td>@if (pick(s, ['status'])) { <app-status-chip [status]="pick(s, ['status'])" [tone]="chipTone(pick(s, ['status']))"></app-status-chip> }</td>
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
      display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap;
      margin-bottom: var(--space-5);
    }
    .refresh-btn { margin-left: auto; }
    .hero-title { display: flex; align-items: center; gap: var(--space-3); }
    .hero-icon {
      width: 48px; height: 48px; border-radius: var(--radius-md);
      background: var(--color-primary-soft); color: var(--color-primary);
      display: flex; align-items: center; justify-content: center;
    }
    .hero-icon mat-icon { font-size: var(--text-3xl); width: 24px; height: 24px; }
    .hero-title h2 { margin: 0; font-size: var(--text-xl); font-weight: 700; color: var(--color-text); }
    .hero-title p { margin: 2px 0 0; color: var(--color-text-3); font-size: var(--text-md); }

    .province-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-5);
    }
    .province-card {
      background: var(--color-surface); border: 1px solid var(--color-line);
      border-radius: var(--radius-lg); padding: var(--space-5); color: var(--color-text); cursor: pointer;
      box-shadow: var(--shadow-sm); transition: border-color 0.2s, box-shadow 0.2s;
      display: flex; flex-direction: column; gap: 14px;
    }
    .province-card:hover { border-color: var(--color-line-strong); box-shadow: var(--shadow-md); }
    .pc-icon {
      width: 48px; height: 48px; border-radius: var(--radius-md);
      background: var(--color-primary-soft); color: var(--color-primary);
      display: flex; align-items: center; justify-content: center;
    }
    .pc-icon mat-icon { font-size: var(--text-3xl); width: 24px; height: 24px; }
    .province-card h2 { margin: 0; font-size: var(--text-2xl); font-weight: 700; color: var(--color-text); }
    .pc-status { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); color: var(--color-text-2); }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--color-line-strong); display: inline-block; }
    .dot.ok { background: var(--color-ok); }
    .dot.bad { background: var(--color-danger); }
    .warn-pill { background: var(--color-warn-soft); color: var(--color-warn); padding: 2px 8px; border-radius: 999px; font-size: var(--text-xs); font-weight: 600; }
    .pc-stats { display: flex; gap: 18px; margin-top: 4px; }
    .pc-stats div { display: flex; flex-direction: column; }
    .pc-stats strong { font-size: var(--text-xl); color: var(--color-text); }
    .pc-stats span { font-size: var(--text-xs); color: var(--color-text-3); }
    .enter-btn { margin-top: 8px; align-self: flex-start; }
    .hint {
      display: flex; align-items: center; gap: 8px; justify-content: center;
      margin-top: 24px; color: var(--color-text-3); font-size: var(--text-sm);
    }
    .hint mat-icon { font-size: var(--text-xl); width: 18px; height: 18px; }

    .notice {
      display: flex; align-items: center; gap: 16px; background: var(--color-warn-soft); border: 1px solid var(--color-warn-soft);
      border-radius: var(--radius-lg); padding: 16px 20px; margin-bottom: 20px;
    }
    .notice mat-icon { color: var(--color-warn); font-size: var(--text-4xl); width: 32px; height: 32px; }
    .notice h3 { margin: 0; color: var(--color-warn); font-size: var(--text-lg); }
    .notice p { margin: 4px 0 0; color: var(--color-text-2); font-size: var(--text-sm); }
    .notice-body { flex: 1; }
    .notice.ok { background: var(--color-ok-soft); border-color: var(--color-ok-soft); }
    .notice.ok mat-icon { color: var(--color-ok); }
    .notice.ok h3 { color: var(--color-ok); }
    .notice.ok p { color: var(--color-text-2); }

    .stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card {
      background: var(--color-surface); border: 1px solid var(--color-line);
      border-radius: var(--radius-lg); padding: 18px; display: flex; align-items: center; gap: 14px;
      box-shadow: var(--shadow-sm);
    }
    .stat-card.wide { grid-column: span 2; }
    .sc-icon {
      width: 48px; height: 48px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;
      background: var(--color-primary-soft); color: var(--color-primary);
    }
    .sc-icon.green { background: var(--color-ok-soft); color: var(--color-ok); }
    .sc-icon.amber { background: var(--color-warn-soft); color: var(--color-warn); }
    .sc-icon.red { background: var(--color-danger-soft); color: var(--color-danger); }
    .sc-icon.accent { background: var(--color-cat-pink-soft); color: var(--color-cat-pink); }
    .sc-body { display: flex; flex-direction: column; }
    .sc-num { font-size: var(--text-3xl); font-weight: 700; color: var(--color-text); }
    .sc-label { font-size: var(--text-xs); color: var(--color-text-3); }

    .sdm-tabs { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
    .table-wrap { padding-bottom: 8px; overflow-x: auto; }
    .table-note { padding: 8px 16px; color: var(--color-text-3); font-size: var(--text-xs); }
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

  constructor(public svc: SchoolDeliveryService, private toast: ToastService, private dialog: MatDialog) {}

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
        this.toast.done(`Signed in to ${target.name}`);
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
        this.toast.done('Signed out');
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

  chipTone(status: any): ChipTone {
    const c = this.statusClass(status);
    return c === 'bad' ? 'danger' : c === '' ? 'neutral' : c as ChipTone;
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
    <div class="sdm-login">
      <div class="dlg-hero">
        <button aria-label="Close" mat-icon-button class="close-x" (click)="ref.close(false)" [disabled]="loading" tabindex="-1">
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
          <button [attr.aria-label]="showPw ? 'Hide password' : 'Show password'" type="button" class="eye" (click)="showPw = !showPw" tabindex="-1">
            <mat-icon>{{ showPw ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
        </div>

        @if (error) {
          <div class="dlg-error"><mat-icon>error_outline</mat-icon><span>{{ error }}</span></div>
        }

        <button mat-flat-button color="primary" class="go-btn" (click)="submit()" [disabled]="!email || !password">
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
            <button mat-stroked-button class="retry-btn" (click)="reset()">
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
      position: relative;
      padding: 28px 32px 20px; color: var(--color-text); text-align: center;
      margin: 0; background: var(--color-surface); border-bottom: 1px solid var(--color-line);
    }
    .close-x {
      position: absolute; top: 8px; right: 8px; color: var(--color-text-3);
    }
    .hero-badge {
      width: 56px; height: 56px; border-radius: var(--radius-lg); margin: 0 auto 12px;
      background: var(--color-primary-soft); color: var(--color-primary);
      display: flex; align-items: center; justify-content: center;
    }
    .hero-badge mat-icon { font-size: var(--text-4xl); width: 32px; height: 32px; }
    .dlg-hero h2 { margin: 0; font-size: var(--text-2xl); font-weight: 800; }
    .dlg-hero p { margin: 4px 0 0; font-size: var(--text-sm); color: var(--color-text-3); }

    .dlg-body { padding: 24px 30px; }
    .welcome { text-align: center; margin-bottom: 24px; }
    .welcome h3 { margin: 0; font-size: var(--text-xl); font-weight: 700; color: var(--color-text); }
    .welcome p { margin: 6px auto 0; font-size: var(--text-sm); color: var(--color-text-3); max-width: 320px; line-height: 1.5; }

    .field-label {
      display: block; font-size: var(--text-sm); font-weight: 600; color: var(--color-text-2);
      margin: 0 0 8px 2px;
    }
    .field {
      display: flex; align-items: center; gap: 12px;
      background: var(--color-surface); border: 1px solid var(--color-line-strong); border-radius: var(--radius-control);
      padding: 0 14px; height: 48px; margin-bottom: 18px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .field.focused {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px var(--color-primary-soft);
    }
    .field > mat-icon { color: var(--color-text-3); font-size: var(--text-2xl); width: 20px; height: 20px; transition: color 0.2s; }
    .field.focused > mat-icon { color: var(--color-primary); }
    .field input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: var(--text-md); color: var(--color-text); height: 100%;
    }
    .field input::placeholder { color: var(--color-text-3); }
    .eye {
      border: none; background: transparent; cursor: pointer; color: var(--color-text-3);
      display: flex; align-items: center; padding: 4px; border-radius: var(--radius-sm);
    }
    .eye:hover { color: var(--color-text-2); background: var(--color-surface-2); }

    .dlg-error {
      display: flex; align-items: center; gap: 10px; background: var(--color-danger-soft); color: var(--color-danger);
      border-radius: var(--radius-md); padding: 12px 14px; font-size: var(--text-sm);
      margin: 2px 0 18px;
    }
    .dlg-error mat-icon { font-size: var(--text-2xl); width: 20px; height: 20px; flex-shrink: 0; }

    .go-btn { width: 100%; height: 44px; }

    .secure-note {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      margin: 18px 0 0; font-size: var(--text-xs); color: var(--color-text-3); text-align: center;
    }
    .secure-note mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; }

    /* Progress sequence */
    .progress-panel { padding: 8px 0 4px; }
    .progress-track {
      height: 8px; background: var(--color-surface-2); border-radius: 999px; overflow: hidden; margin-bottom: 24px;
    }
    .progress-fill {
      height: 100%; border-radius: 999px; transition: width 0.5s cubic-bezier(0.4,0,0.2,1);
      background: var(--color-primary);
    }
    .steps { display: flex; flex-direction: column; gap: 6px; }
    .step {
      display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: var(--radius-md);
      transition: background 0.3s; opacity: 0.5;
    }
    .step.active { background: var(--color-primary-soft); opacity: 1; }
    .step.done { opacity: 1; }
    .step.failed { opacity: 1; background: var(--color-danger-soft); }
    .step-icon {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--color-surface-2); color: var(--color-text-3); transition: background 0.3s, color 0.3s;
    }
    .step.active .step-icon { background: var(--color-surface); }
    .step.done .step-icon { background: var(--color-ok-soft); color: var(--color-ok); }
    .step.failed .step-icon { background: var(--color-danger-soft); color: var(--color-danger); }
    .step-icon mat-icon { font-size: var(--text-xl); width: 18px; height: 18px; }
    .step-icon .dot-idle { width: 8px; height: 8px; border-radius: 50%; background: var(--color-line-strong); }
    .step-label { font-size: var(--text-md); font-weight: 600; color: var(--color-text-2); }
    .step.active .step-label { color: var(--color-primary); }

    .progress-hint { text-align: center; color: var(--color-text-3); font-size: var(--text-sm); margin: 22px 0 4px; }
    .retry-btn { width: 100%; height: 44px; margin-top: 18px; }
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
