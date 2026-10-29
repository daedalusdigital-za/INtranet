import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { ToastService } from '../../ui/toast.service';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { environment } from '../../../environments/environment';

interface RosterLine {
  employeeId: number | null;
  name: string;
  department?: string;
  jobTitle?: string;
  employmentType?: string;
  status: string;
  timeIn?: string;
  timeOut?: string;
  notes?: string;
  entryId?: number | null;
}

@Component({
  selector: 'app-daily-register',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, SkeletonRowsComponent, EmptyStateComponent],
  template: `
  <div class="reg-wrap">
    <header class="reg-head">
      <div class="rh-left">
        <mat-icon>fact_check</mat-icon>
        <div>
          <h2>Daily Attendance Register</h2>
          <p>For sites that don't clock in — capture who's in, out, or away.</p>
        </div>
      </div>
      <button aria-label="Close" mat-icon-button (click)="close()"><mat-icon>close</mat-icon></button>
    </header>

    <div class="reg-controls">
      <label>Site
        <select [(ngModel)]="site" (change)="loadRoster()">
          <option value="" disabled>Select site…</option>
          @for (s of sites; track s) { <option [value]="s">{{ s }}</option> }
        </select>
      </label>
      <label>Date
        <input type="date" [(ngModel)]="dateStr" (change)="loadRoster()">
      </label>
      <div class="rc-spacer"></div>
      @if (submittedBy) {
        <span class="submitted-tag"><mat-icon>check_circle</mat-icon> Submitted by {{ submittedBy }}</span>
      }
    </div>

    @if (loading) {
      <div class="reg-loading"><app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows></div>
    } @else if (!site) {
      <app-empty-state icon="arrow_upward" title="Choose a site to begin" message="Pick the site and date above to load its roster."></app-empty-state>
    } @else if (roster.length === 0) {
      <app-empty-state icon="groups" [title]="'No employees registered for ' + site + ' yet'"
                       message="Add them in the Employee Directory, or add ad-hoc names below."></app-empty-state>
    } @else {
      <div class="reg-summary">
        <span class="pill present">{{ presentCount() }} in</span>
        <span class="pill absent">{{ absentCount() }} out/away</span>
        <span class="pill total">{{ roster.length + adhoc.length }} total</span>
      </div>

      <div class="reg-table">
        <div class="rt-head">
          <span class="c-name">Employee</span>
          <span class="c-dept">Department</span>
          <span class="c-status">Status</span>
          <span class="c-time">In</span>
          <span class="c-time">Out</span>
          <span class="c-notes">Notes</span>
        </div>
        @for (r of roster; track r.employeeId) {
          <div class="rt-row" [class.away]="!isPresent(r.status)">
            <span class="c-name">{{ r.name }}<small>{{ r.jobTitle }}</small></span>
            <span class="c-dept">{{ r.department || '—' }}</span>
            <span class="c-status">
              <select [(ngModel)]="r.status" [attr.data-s]="r.status">
                @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }
              </select>
            </span>
            <span class="c-time"><input type="time" [(ngModel)]="r.timeIn"></span>
            <span class="c-time"><input type="time" [(ngModel)]="r.timeOut"></span>
            <span class="c-notes"><input [(ngModel)]="r.notes" placeholder="—"></span>
          </div>
        }
        @for (r of adhoc; track $index) {
          <div class="rt-row adhoc" [class.away]="!isPresent(r.status)">
            <span class="c-name"><input [(ngModel)]="r.name" placeholder="Name"><small>ad-hoc</small></span>
            <span class="c-dept"><input [(ngModel)]="r.department" placeholder="Dept"></span>
            <span class="c-status">
              <select [(ngModel)]="r.status" [attr.data-s]="r.status">
                @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }
              </select>
            </span>
            <span class="c-time"><input type="time" [(ngModel)]="r.timeIn"></span>
            <span class="c-time"><input type="time" [(ngModel)]="r.timeOut"></span>
            <span class="c-notes">
              <input [(ngModel)]="r.notes" placeholder="—">
              <button aria-label="Remove person" mat-icon-button class="rm" (click)="removeAdhoc($index)"><mat-icon>close</mat-icon></button>
            </span>
          </div>
        }
      </div>

      <div class="reg-actions">
        <button mat-button (click)="addAdhoc()"><mat-icon>person_add</mat-icon> Add person</button>
        <div class="ra-spacer"></div>
        <button mat-flat-button color="primary" (click)="submit()" [disabled]="saving">
          <mat-icon>save</mat-icon> {{ saving ? 'Saving…' : 'Submit Register' }}
        </button>
      </div>
    }
  </div>
  `,
  styles: [`
    .reg-wrap { background:var(--color-surface); color:var(--color-text); min-height:60vh; }
    .reg-head { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid var(--color-line); }
    .rh-left { display:flex; align-items:center; gap:14px; }
    .rh-left mat-icon { font-size:var(--text-3xl); width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-md); background:var(--color-primary-soft); color:var(--color-primary); }
    .rh-left h2 { margin:0; font-size:var(--text-2xl); color:var(--color-text); }
    .rh-left p { margin:2px 0 0; font-size:var(--text-sm); color:var(--color-text-3); }
    .reg-controls { display:flex; align-items:flex-end; gap:16px; padding:18px 24px; flex-wrap:wrap; }
    .reg-controls label { display:flex; flex-direction:column; font-size:var(--text-xs); color:var(--color-text-2); gap:5px; }
    .reg-controls select, .reg-controls input { background:var(--color-surface); border:1px solid var(--color-line-strong); color:var(--color-text); border-radius:var(--radius-control); padding:8px 10px; min-width:180px; }
    .rc-spacer { flex:1; }
    .submitted-tag { display:flex; align-items:center; gap:6px; color:var(--color-ok); font-size:var(--text-sm); }
    .submitted-tag mat-icon { font-size:var(--text-xl); width:18px; height:18px; }
    .reg-loading { padding:0 24px; }
    .reg-summary { display:flex; gap:10px; padding:0 24px 12px; }
    .pill { padding:5px 12px; border-radius:999px; font-size:var(--text-xs); font-weight:600; }
    .pill.present { background:var(--color-ok-soft); color:var(--color-ok); }
    .pill.absent { background:var(--color-danger-soft); color:var(--color-danger); }
    .pill.total { background:var(--color-surface-2); color:var(--color-text-2); }
    .reg-table { padding:0 24px; }
    .rt-head, .rt-row { display:grid; grid-template-columns:1.6fr 1.1fr 1.1fr .8fr .8fr 1.4fr; gap:10px; align-items:center; }
    .rt-head { padding:8px 4px; font-size:var(--text-xs); font-weight:600; text-transform:uppercase; letter-spacing:.5px; color:var(--color-text-2); background:var(--color-surface-2); border-bottom:1px solid var(--color-line); }
    .rt-row { padding:var(--row-pad-y) 4px; border-bottom:1px solid var(--color-line); }
    .rt-row.away { opacity:.72; }
    .c-name { display:flex; flex-direction:column; font-size:var(--text-md); }
    .c-name small { color:var(--color-text-3); font-size:var(--text-xs); }
    .rt-row select, .rt-row input { width:100%; background:var(--color-surface); border:1px solid var(--color-line-strong); color:var(--color-text); border-radius:var(--radius-sm); padding:6px 8px; font-size:var(--text-sm); }
    .rt-row select[data-s="Absent"] { color:var(--color-danger); }
    .rt-row select[data-s="On Leave"], .rt-row select[data-s="Sick"] { color:var(--color-warn); }
    .c-notes { display:flex; align-items:center; gap:4px; }
    .rm mat-icon { font-size:var(--text-lg); }
    .reg-actions { display:flex; align-items:center; padding:18px 24px; gap:10px; }
    .ra-spacer { flex:1; }
  `]
})
export class DailyRegisterComponent implements OnInit {
  sites: string[] = [];
  statuses: string[] = ['Present', 'Absent', 'On Leave', 'Sick', 'Off', 'Working Offsite', 'Half Day'];
  site = '';
  dateStr = new Date().toISOString().slice(0, 10);
  roster: RosterLine[] = [];
  adhoc: RosterLine[] = [];
  loading = false;
  saving = false;
  submittedBy: string | null = null;

  constructor(
    private http: HttpClient,
    private toast: ToastService,
    private dialogRef: MatDialogRef<DailyRegisterComponent>
  ) {}

  ngOnInit(): void {
    this.http.get<string[]>(`${environment.apiUrl}/hr-registers/statuses`, { headers: this.headers() })
      .subscribe({ next: s => { if (s?.length) this.statuses = s; }, error: () => {} });
    this.http.get<string[]>(`${environment.apiUrl}/hr-employees/sites`, { headers: this.headers() })
      .subscribe({ next: s => this.sites = s, error: () => {} });
  }

  private headers(): HttpHeaders {
    const t = localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${t}` });
  }

  loadRoster(): void {
    if (!this.site) return;
    this.loading = true;
    this.submittedBy = null;
    const url = `${environment.apiUrl}/hr-registers/roster?site=${encodeURIComponent(this.site)}&date=${this.dateStr}`;
    this.http.get<any>(url, { headers: this.headers() }).subscribe({
      next: r => {
        this.roster = r.roster || [];
        this.adhoc = r.adhoc || [];
        this.submittedBy = r.submittedBy || null;
        this.loading = false;
      },
      error: () => { this.loading = false; this.toast.error('Could not load roster.'); }
    });
  }

  isPresent(s: string): boolean { return ['Present', 'Working Offsite', 'Half Day'].includes(s); }
  presentCount(): number { return [...this.roster, ...this.adhoc].filter(r => this.isPresent(r.status)).length; }
  absentCount(): number { return [...this.roster, ...this.adhoc].filter(r => !this.isPresent(r.status)).length; }

  addAdhoc(): void {
    this.adhoc.push({ employeeId: null, name: '', department: '', status: 'Present' });
  }
  removeAdhoc(i: number): void { this.adhoc.splice(i, 1); }

  submit(): void {
    this.saving = true;
    const lines = [...this.roster, ...this.adhoc]
      .filter(r => (r.name || '').trim())
      .map(r => ({
        employeeId: r.employeeId,
        employeeName: r.name,
        department: r.department,
        status: r.status,
        timeIn: r.timeIn,
        timeOut: r.timeOut,
        notes: r.notes
      }));
    const body = { site: this.site, date: new Date(this.dateStr).toISOString(), lines };
    this.http.post<any>(`${environment.apiUrl}/hr-registers/submit`, body, { headers: this.headers() })
      .subscribe({
        next: res => {
          this.saving = false;
          this.toast.done(`Register submitted — ${res.saved} entries.`);
          this.loadRoster();
        },
        error: () => { this.saving = false; this.toast.error('Submit failed.'); }
      });
  }

  close(): void { this.dialogRef.close(); }
}
