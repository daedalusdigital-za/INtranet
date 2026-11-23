import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api, Executive } from '../core/api';

/** Director overview — the same figures as the intranet Directors › Overview, laid out for a phone. Read-only. */
@Component({
  selector: 'app-overview',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  template: `
    <div class="head">
      <div><h1>Overview</h1><p class="muted">Where every payment pack stands across your companies.</p></div>
      <button type="button" class="btn ghost sm" (click)="load()" [disabled]="loading()">Refresh</button>
    </div>
    @if (loading()) { <div class="spinner"></div> }
    @else if (forbidden()) { <div class="card empty"><div class="big">🔒</div><h2>Overview is for directors</h2><p class="muted">Your account can approve packs but doesn't have the executive overview. Use <a routerLink="/">Sign</a> for what's waiting for you.</p></div> }
    @else if (error()) { <p class="err">{{ error() }}</p> }
    @else if (d(); as d) {
      <div class="kpis">
        <a class="card kpi accent" routerLink="/">
          <span class="k">Waiting for you</span><b>{{ d.awaitingForMe }}</b>
          <span class="muted sm">{{ d.awaitingAmount | currency:'ZAR':'R ':'1.0-0' }} awaiting signature in total</span>
        </a>
        <a class="card kpi" routerLink="/payruns">
          <span class="k">Next pay-run</span><b>{{ d.nextPayDay | date:'EEE d MMM' }}</b>
          <span class="muted sm">{{ (d.schedule[0]?.amount ?? 0) | currency:'ZAR':'R ':'1.0-0' }} booked</span>
        </a>
        <a class="card kpi" routerLink="/history">
          <span class="k">Paid this month</span><b class="amt">{{ d.paidThisMonth | currency:'ZAR':'R ':'1.0-0' }}</b>
          <span class="muted sm">{{ d.signedLast30 }} pack{{ d.signedLast30 === 1 ? '' : 's' }} signed in 30 days</span>
        </a>
        <a class="card kpi" [class.warn]="d.awaitingPopAmount > 0" routerLink="/payruns">
          <span class="k">Awaiting proof of payment</span><b class="amt">{{ d.awaitingPopAmount | currency:'ZAR':'R ':'1.0-0' }}</b>
          <span class="muted sm">paid, not yet closed</span>
        </a>
      </div>

      @if (d.awaiting.length) {
        <h2 class="sec">Awaiting director signature</h2>
        <div class="list">
          @for (a of d.awaiting; track a.id) {
            <a class="card row" [routerLink]="['/pack', a.id]">
              <div><div class="co">{{ a.companyName }} <span class="pill neutral">{{ a.paymentTypeTitle }}</span></div>
                <div class="muted sm">{{ a.batchNumber }} · {{ a.items }} payment{{ a.items === 1 ? '' : 's' }}@if (a.waitingDays) { · waiting {{ a.waitingDays }} day{{ a.waitingDays === 1 ? '' : 's' }} }</div>
                @if (a.forMe) { <span class="pill ok">For you</span> }</div>
              <div class="amt big2">{{ a.totalAmount | currency:'ZAR':'R ':'1.0-0' }}</div>
            </a>
          }
        </div>
      }

      @if (d.schedule.length) {
        <h2 class="sec">Upcoming pay-runs</h2>
        <div class="card">
          @for (s of d.schedule; track s.date) {
            <a class="line" routerLink="/payruns"><span>{{ s.date | date:'EEE d MMM' }} <span class="muted sm">· {{ s.count }} pack{{ s.count === 1 ? '' : 's' }}</span></span><b class="amt">{{ s.amount | currency:'ZAR':'R ':'1.0-0' }}</b></a>
          }
        </div>
      }

      @if (d.pipeline.length) {
        <h2 class="sec">Pipeline</h2>
        <div class="card">
          @for (p of d.pipeline; track p.status) {
            <div class="line"><span>{{ p.title }} <span class="muted sm">· {{ p.count }}</span></span><b class="amt">{{ p.amount | currency:'ZAR':'R ':'1.0-0' }}</b></div>
          }
        </div>
      }

      @if (d.perCompany.length) {
        <h2 class="sec">By company</h2>
        <div class="list">
          @for (c of d.perCompany; track c.code) {
            <div class="card co-card">
              <div class="co">{{ c.name }}</div>
              <div class="grid3">
                <div><span class="muted sm">Awaiting signature</span><b class="amt">{{ c.awaitingDirector | currency:'ZAR':'R ':'1.0-0' }}</b></div>
                <div><span class="muted sm">On a pay-run</span><b class="amt">{{ c.onSchedule | currency:'ZAR':'R ':'1.0-0' }}</b></div>
                <div><span class="muted sm">Paid this month</span><b class="amt">{{ c.paidThisMonth | currency:'ZAR':'R ':'1.0-0' }}</b></div>
              </div>
            </div>
          }
        </div>
      }

      @if (d.paidByMonth.length) {
        <h2 class="sec">Paid per month</h2>
        <div class="card">
          @for (m of d.paidByMonth; track m.label) {
            <div class="bar"><span class="bl">{{ m.label }}</span><span class="track"><span class="fill" [style.width.%]="pct(m.total)"></span></span><b class="amt sm">{{ m.total | currency:'ZAR':'R ':'1.0-0' }}</b></div>
          }
        </div>
      }

      @if (d.topSuppliers.length) {
        <h2 class="sec">Top payees · last 90 days</h2>
        <div class="card">
          @for (s of d.topSuppliers; track s.supplier) {
            <div class="line"><span>{{ s.supplier }} <span class="muted sm">· {{ s.payments }} payment{{ s.payments === 1 ? '' : 's' }}</span></span><b class="amt">{{ s.amount | currency:'ZAR':'R ':'1.0-0' }}</b></div>
          }
        </div>
      }
    }
  `,
  styles: [`
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; } h1 { margin: 0 0 4px; font-size: 22px; } .head p { margin: 0; }
    .kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } @media (min-width: 720px) { .kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
    .kpi { display: flex; flex-direction: column; gap: 2px; text-decoration: none; color: inherit; padding: 14px; } .kpi .k { font-size: 13px; color: var(--muted); font-weight: 600; } .kpi b { font-size: 22px; }
    .kpi.accent { border-color: var(--brand); background: #eef2ff; } .kpi.warn b { color: var(--warn); } .kpi:active { background: #eef2ff; }
    .sec { font-size: 16px; margin: 22px 0 8px; }
    .list { display: grid; gap: 10px; }
    .row { display: flex; justify-content: space-between; gap: 12px; align-items: center; text-decoration: none; color: inherit; padding: 14px 16px; } .row:active { background: #eef2ff; }
    .co { font-weight: 700; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; } .row .pill.ok { margin-top: 6px; }
    .big2 { font-weight: 700; font-size: 17px; white-space: nowrap; }
    .line { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; } .line:last-child { border-bottom: 0; } .line:first-child { padding-top: 0; }
    .co-card { padding: 14px 16px; } .grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; } .grid3 div { display: flex; flex-direction: column; } .grid3 b { font-size: 15px; }
    .bar { display: grid; grid-template-columns: 56px 1fr auto; align-items: center; gap: 10px; padding: 6px 0; } .bl { font-size: 13px; color: var(--muted); }
    .track { height: 10px; background: var(--bg); border-radius: 999px; overflow: hidden; } .fill { display: block; height: 100%; background: var(--brand); border-radius: 999px; }
    .sm { font-size: 12px; }
    .empty { text-align: center; padding: 40px 20px; } .big { font-size: 40px; } .empty h2 { margin: 8px 0 4px; }
  `]
})
export class OverviewPage implements OnInit {
  private api = inject(Api);
  d = signal<Executive | null>(null); loading = signal(true); error = signal(''); forbidden = signal(false);
  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true); this.error.set(''); this.forbidden.set(false);
    this.api.executive().subscribe({
      next: d => { this.d.set(d); this.loading.set(false); },
      error: e => { this.loading.set(false); if (e?.status === 403) this.forbidden.set(true); else this.error.set(e?.error?.message ?? "Couldn't load the overview. Check your connection and try again."); }
    });
  }
  pct(v: number) { const max = Math.max(1, ...(this.d()?.paidByMonth ?? []).map(m => m.total)); return Math.round(v / max * 100); }
}
