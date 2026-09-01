import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
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
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
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
      <button mat-icon-button (click)="close()"><mat-icon>close</mat-icon></button>
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
      <div class="reg-empty"><mat-icon>hourglass_top</mat-icon> Loading roster…</div>
    } @else if (!site) {
      <div class="reg-empty"><mat-icon>arrow_upward</mat-icon> Choose a site to begin.</div>
    } @else if (roster.length === 0) {
      <div class="reg-empty">
        <mat-icon>groups</mat-icon>
        <p>No employees registered for <b>{{ site }}</b> yet.</p>
        <span>Add them in the Employee Directory, or add ad-hoc names below.</span>
      </div>
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
              <button mat-icon-button class="rm" (click)="removeAdhoc($index)"><mat-icon>close</mat-icon></button>
            </span>
          </div>
        }
      </div>

      <div class="reg-actions">
        <button mat-button (click)="addAdhoc()"><mat-icon>person_add</mat-icon> Add person</button>
        <div class="ra-spacer"></div>
        <button mat-flat-button class="save" (click)="submit()" [disabled]="saving">
          <mat-icon>save</mat-icon> {{ saving ? 'Saving…' : 'Submit Register' }}
        </button>
      </div>
    }
  </div>
  `,
  styles: [`
    .reg-wrap { background:#0f172a; color:#e2e8f0; min-height:60vh; }
    .reg-head { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid #1e293b; }
    .rh-left { display:flex; align-items:center; gap:14px; }
    .rh-left mat-icon { font-size:34px; width:34px; height:34px; color:#38bdf8; }
    .rh-left h2 { margin:0; font-size:20px; }
    .rh-left p { margin:2px 0 0; font-size:13px; color:#94a3b8; }
    .reg-controls { display:flex; align-items:flex-end; gap:16px; padding:18px 24px; flex-wrap:wrap; }
    .reg-controls label { display:flex; flex-direction:column; font-size:12px; color:#94a3b8; gap:5px; }
    .reg-controls select, .reg-controls input { background:#1e293b; border:1px solid #334155; color:#e2e8f0; border-radius:8px; padding:8px 10px; min-width:180px; }
    .rc-spacer { flex:1; }
    .submitted-tag { display:flex; align-items:center; gap:6px; color:#4ade80; font-size:13px; }
    .submitted-tag mat-icon { font-size:18px; width:18px; height:18px; }
    .reg-empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:60px; color:#64748b; text-align:center; }
    .reg-empty mat-icon { font-size:40px; width:40px; height:40px; }
    .reg-summary { display:flex; gap:10px; padding:0 24px 12px; }
    .pill { padding:5px 12px; border-radius:999px; font-size:12px; font-weight:600; }
    .pill.present { background:rgba(74,222,128,.15); color:#4ade80; }
    .pill.absent { background:rgba(248,113,113,.15); color:#f87171; }
    .pill.total { background:#1e293b; color:#94a3b8; }
    .reg-table { padding:0 24px; }
    .rt-head, .rt-row { display:grid; grid-template-columns:1.6fr 1.1fr 1.1fr .8fr .8fr 1.4fr; gap:10px; align-items:center; }
    .rt-head { padding:8px 4px; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:#64748b; border-bottom:1px solid #1e293b; }
    .rt-row { padding:8px 4px; border-bottom:1px solid #16223a; }
    .rt-row.away { opacity:.72; }
    .c-name { display:flex; flex-direction:column; font-size:14px; }
    .c-name small { color:#64748b; font-size:11px; }
    .rt-row select, .rt-row input { width:100%; background:#1e293b; border:1px solid #334155; color:#e2e8f0; border-radius:7px; padding:6px 8px; font-size:13px; }
    .rt-row select[data-s="Absent"] { color:#f87171; }
    .rt-row select[data-s="On Leave"], .rt-row select[data-s="Sick"] { color:#fbbf24; }
    .c-notes { display:flex; align-items:center; gap:4px; }
    .rm mat-icon { font-size:16px; }
    .reg-actions { display:flex; align-items:center; padding:18px 24px; gap:10px; }
    .ra-spacer { flex:1; }
    .save { background:#2563eb; color:#fff; }
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
    private snack: MatSnackBar,
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
      error: () => { this.loading = false; this.snack.open('Could not load roster.', 'OK', { duration: 3000 }); }
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
          this.snack.open(`Register submitted — ${res.saved} entries.`, 'OK', { duration: 3000 });
          this.loadRoster();
        },
        error: () => { this.saving = false; this.snack.open('Submit failed.', 'OK', { duration: 3000 }); }
      });
  }

  close(): void { this.dialogRef.close(); }
}
