import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Chart } from 'chart.js/auto';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { CreditorPacksService, ExecutiveOverview } from '../../services/creditor-packs.service';

const COMPANY_COLOURS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];

/**
 * Executive — the directors' cockpit.
 * Sign what is waiting, see what is booked for the next pay-runs, and watch the companies
 * (spend per month, per payment type, top suppliers, per-company health).
 */
@Component({
  selector: 'app-executive',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule, NavbarComponent, PageHeaderComponent],
  template: `
<app-navbar></app-navbar>
<div class="ex-container">
  <div class="ex-inner">
    <app-page-header [crumbs]="['Oversight', 'Executive']" title="Executive"
                     subtitle="Approve and sign supplier payments, see what is booked for the Monday / Wednesday pay-runs, and how each company is doing.">
      <button mat-stroked-button (click)="load()" [disabled]="loading"><mat-icon>refresh</mat-icon>Refresh</button>
      <button mat-flat-button color="primary" (click)="goFinance()"><mat-icon>account_balance</mat-icon>Creditors</button>
    </app-page-header>

    @if (loading && !d) {
      <div class="ex-loading"><mat-spinner diameter="36"></mat-spinner><span>Loading the executive view…</span></div>
    } @else if (error) {
      <div class="ex-error"><mat-icon>lock</mat-icon><div><b>{{ error }}</b><p>The Executive page is for directors and administrators. Ask Finance to add you as a director on a company.</p></div></div>
    } @else if (d) {

      <!-- KPIs -->
      <div class="ex-kpis">
        <div class="kpi accent" (click)="scrollTo('awaiting')">
          <mat-icon>draw</mat-icon>
          <div><span class="v">{{ d.awaitingForMe }}</span><span class="l">Awaiting <b>your</b> signature</span>
            <span class="s">{{ d.awaiting.length }} in total · {{ d.awaitingAmount | currency:'ZAR':'R':'1.0-0' }}</span></div>
        </div>
        <div class="kpi">
          <mat-icon>event_available</mat-icon>
          <div><span class="v">{{ d.nextPayDay | date:'EEE d MMM' }}</span><span class="l">Next pay-run</span>
            <span class="s">{{ nextRun()?.count || 0 }} batches · {{ (nextRun()?.amount || 0) | currency:'ZAR':'R':'1.0-0' }}</span></div>
        </div>
        <div class="kpi">
          <mat-icon>verified</mat-icon>
          <div><span class="v">{{ d.signedLast30 }}</span><span class="l">Signed in last 30 days</span>
            <span class="s">{{ d.signedLast30Amount | currency:'ZAR':'R':'1.0-0' }}</span></div>
        </div>
        <div class="kpi">
          <mat-icon>payments</mat-icon>
          <div><span class="v">{{ d.paidThisMonth | currency:'ZAR':'R':'1.0-0' }}</span><span class="l">Paid this month</span>
            <span class="s">all companies</span></div>
        </div>
        <div class="kpi" [class.warn]="d.awaitingPopAmount > 0">
          <mat-icon>receipt_long</mat-icon>
          <div><span class="v">{{ d.awaitingPopAmount | currency:'ZAR':'R':'1.0-0' }}</span><span class="l">Paid, POP outstanding</span>
            <span class="s">treasurer to upload proof</span></div>
        </div>
      </div>

      <!-- Pipeline -->
      <section class="ex-card">
        <header><mat-icon>route</mat-icon><h3>Payment pipeline</h3><span class="muted">where every open batch sits right now</span></header>
        <div class="pipe">
          @for (p of d.pipeline; track p.status) {
            <div class="pipe-step" [class.hot]="p.status === 'AwaitingDirector'" [class.empty]="p.count === 0">
              <span class="c">{{ p.count }}</span>
              <span class="t">{{ p.title }}</span>
              <span class="a">{{ p.amount | currency:'ZAR':'R':'1.0-0' }}</span>
            </div>
            @if (!$last) { <mat-icon class="arrow">chevron_right</mat-icon> }
          }
        </div>
      </section>

      <div class="ex-grid">
        <!-- Awaiting signature -->
        <section class="ex-card span2" id="awaiting">
          <header><mat-icon>draw</mat-icon><h3>Awaiting director signature</h3>
            <span class="muted">checked by the accountant, ready for you</span></header>
          @if (!d.awaiting.length) {
            <div class="empty"><mat-icon>task_alt</mat-icon>Nothing is waiting for a signature. Well done.</div>
          } @else {
            <div class="await-list">
              @for (b of d.awaiting; track b.id) {
                <div class="await" [class.mine]="b.forMe">
                  <div class="await-main">
                    <div class="await-head">
                      <span class="chip co">{{ b.companyCode }}</span>
                      <b>{{ b.batchNumber }}</b>
                      <span class="chip type">{{ b.paymentTypeTitle }}</span>
                      @if (b.forMe) { <span class="chip mine">For you</span> }
                      @if (b.waitingDays >= 3) { <span class="chip late">Waiting {{ b.waitingDays }}d</span> }
                      @if (b.checksStatus && b.checksStatus !== 'Passed') { <span class="chip warn">Checks: {{ b.checksStatus }}</span> }
                    </div>
                    <div class="await-sub">
                      {{ b.companyName }} · {{ b.items }} payment{{ b.items === 1 ? '' : 's' }} · prepared by {{ b.preparedByName || '—' }}
                      @if (b.accountantName) { · checked by {{ b.accountantName }} {{ b.accountantApprovedAt | date:'d MMM HH:mm' }} }
                    </div>
                    <div class="await-sups">
                      @for (s of b.suppliers.slice(0, 5); track $index) {
                        <span class="sup">{{ s.supplierName }} <em>{{ s.amount | currency:'ZAR':'R':'1.0-0' }}</em></span>
                      }
                      @if (b.suppliers.length > 5) { <span class="sup more">+{{ b.suppliers.length - 5 }} more</span> }
                    </div>
                  </div>
                  <div class="await-side">
                    <span class="amt">{{ b.totalAmount | currency:'ZAR':'R':'1.2-2' }}</span>
                    <button mat-flat-button color="primary" (click)="openBatch(b.id)"><mat-icon>draw</mat-icon>Review &amp; sign</button>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <!-- Pay-run schedule -->
        <section class="ex-card">
          <header><mat-icon>event_available</mat-icon><h3>Pay-runs</h3><span class="muted">Mon &amp; Wed</span></header>
          @if (!d.schedule.length) {
            <div class="empty small"><mat-icon>event_busy</mat-icon>Nothing booked yet.</div>
          } @else {
            <ul class="runs">
              @for (r of d.schedule; track r.date) {
                <li [class.next]="r.date === d.nextPayDay">
                  <div class="rd"><b>{{ r.date | date:'EEE d MMM' }}</b>@if (r.date === d.nextPayDay) {<span class="chip mine">Next</span>}</div>
                  <div class="rs">{{ r.count }} batch{{ r.count === 1 ? '' : 'es' }} · {{ r.amount | currency:'ZAR':'R':'1.0-0' }}</div>
                  <div class="rbar">
                    <span class="paid" [style.width.%]="pct(r.paid, r.count)" matTooltip="Paid"></span>
                    <span class="loaded" [style.width.%]="pct(r.loaded, r.count)" matTooltip="Loaded on bank"></span>
                  </div>
                  <div class="rl"><span><i class="dot paid"></i>{{ r.paid }} paid</span><span><i class="dot loaded"></i>{{ r.loaded }} loaded</span><span><i class="dot todo"></i>{{ r.count - r.paid - r.loaded }} to load</span></div>
                </li>
              }
            </ul>
          }
          <button mat-stroked-button class="full" (click)="goSchedule()"><mat-icon>open_in_new</mat-icon>Open payment schedule</button>
        </section>

        <!-- Charts -->
        <section class="ex-card span2">
          <header><mat-icon>bar_chart</mat-icon><h3>Paid per month, by company</h3><span class="muted">last 6 months</span></header>
          <div class="chart-wrap tall"><canvas #monthChart></canvas></div>
        </section>
        <section class="ex-card">
          <header><mat-icon>donut_large</mat-icon><h3>Spend by payment type</h3><span class="muted">last 6 months</span></header>
          <div class="chart-wrap"><canvas #typeChart></canvas></div>
        </section>

        <section class="ex-card">
          <header><mat-icon>storefront</mat-icon><h3>Top suppliers</h3><span class="muted">last 6 months</span></header>
          <div class="chart-wrap tall"><canvas #supplierChart></canvas></div>
        </section>

        <!-- Companies -->
        <section class="ex-card span2">
          <header><mat-icon>domain</mat-icon><h3>Companies</h3><span class="muted">health of each paying company</span></header>
          <div class="table-wrap">
            <table class="co-table">
              <thead><tr>
                <th>Company</th><th>Director</th><th>Accountant</th>
                <th class="num">Awaiting signature</th><th class="num">In preparation</th><th class="num">On schedule</th>
                <th class="num">Paid this month</th><th class="num">Paid 90d</th><th class="num">POP outstanding</th>
              </tr></thead>
              <tbody>
                @for (c of d.perCompany; track c.code; let i = $index) {
                  <tr>
                    <td><span class="sw" [style.background]="colour(i)"></span><b>{{ c.code }}</b><div class="sub">{{ c.name }}@if (c.activity) { · {{ c.activity }} }</div></td>
                    <td>{{ c.directorName || '—' }}</td>
                    <td>{{ c.accountantName || '—' }}</td>
                    <td class="num" [class.hot]="c.awaitingDirectorCount > 0">{{ c.awaitingDirectorCount }} · {{ c.awaitingDirector | currency:'ZAR':'R':'1.0-0' }}</td>
                    <td class="num">{{ c.inPreparation | currency:'ZAR':'R':'1.0-0' }}</td>
                    <td class="num">{{ c.onSchedule | currency:'ZAR':'R':'1.0-0' }}</td>
                    <td class="num">{{ c.paidThisMonth | currency:'ZAR':'R':'1.0-0' }}</td>
                    <td class="num">{{ c.paidLast90 | currency:'ZAR':'R':'1.0-0' }}</td>
                    <td class="num" [class.warn]="c.awaitingPop > 0">{{ c.awaitingPop | currency:'ZAR':'R':'1.0-0' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <p class="gen">Generated {{ d.generatedAt | date:'d MMM yyyy HH:mm' }}</p>
    }
  </div>
</div>
  `,
  styles: [`
:host { display:block; }
.ex-container { padding: 0 0 48px; }
.ex-inner { max-width: 1400px; margin: 0 auto; padding: 0 24px; }
.ex-loading, .ex-error { display:flex; align-items:center; gap:14px; padding: 40px 0; color: var(--text-muted, #64748b); }
.ex-error { color: var(--text, #0f172a); } .ex-error mat-icon { font-size: 36px; width:36px; height:36px; color:#ef4444; } .ex-error p { margin: 4px 0 0; color: var(--text-muted,#64748b); }

.ex-kpis { display:grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin: 18px 0; }
.kpi { display:flex; gap:14px; align-items:center; padding:16px 18px; border-radius:14px; background: var(--surface, #fff); border:1px solid var(--border, #e5e7eb); }
.kpi mat-icon { font-size:30px; width:30px; height:30px; color: var(--primary, #4f46e5); }
.kpi .v { display:block; font-size:22px; font-weight:800; line-height:1.1; }
.kpi .l { display:block; font-size:13px; color: var(--text-muted,#64748b); margin-top:2px; }
.kpi .s { display:block; font-size:12px; color: var(--text-muted,#94a3b8); margin-top:2px; }
.kpi.accent { cursor:pointer; background: linear-gradient(135deg, rgba(79,70,229,.12), rgba(14,165,233,.08)); border-color: rgba(79,70,229,.35); }
.kpi.warn mat-icon { color:#f59e0b; }

.ex-card { background: var(--surface,#fff); border:1px solid var(--border,#e5e7eb); border-radius:14px; padding:18px 20px; margin-bottom:16px; min-width:0; }
.ex-card header { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
.ex-card header h3 { margin:0; font-size:16px; font-weight:700; }
.ex-card header mat-icon { color: var(--primary,#4f46e5); }
.muted { color: var(--text-muted,#64748b); font-size:12px; margin-left:auto; }

.pipe { display:flex; align-items:stretch; gap:4px; overflow-x:auto; padding-bottom:4px; }
.pipe-step { flex:1; min-width:120px; text-align:center; padding:10px 8px; border-radius:10px; background: var(--surface-2, #f8fafc); border:1px solid var(--border,#e5e7eb); }
.pipe-step.hot { background: rgba(79,70,229,.1); border-color: rgba(79,70,229,.4); }
.pipe-step.empty { opacity:.55; }
.pipe-step .c { display:block; font-size:20px; font-weight:800; }
.pipe-step .t { display:block; font-size:12px; color: var(--text-muted,#64748b); }
.pipe-step .a { display:block; font-size:12px; font-weight:600; margin-top:2px; }
.pipe .arrow { align-self:center; color: var(--text-muted,#94a3b8); }

.ex-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:16px; }
.ex-grid .ex-card { margin:0; }
.span2 { grid-column: span 2; }
@media (max-width: 1100px) { .ex-grid { grid-template-columns: 1fr; } .span2 { grid-column: span 1; } }

.empty { display:flex; align-items:center; gap:10px; padding:28px 12px; justify-content:center; color: var(--text-muted,#64748b); }
.empty mat-icon { color:#10b981; } .empty.small { padding:16px; }

.await-list { display:flex; flex-direction:column; gap:10px; }
.await { display:flex; gap:16px; padding:14px 16px; border-radius:12px; border:1px solid var(--border,#e5e7eb); background: var(--surface-2,#f8fafc); }
.await.mine { border-color: rgba(79,70,229,.45); background: rgba(79,70,229,.06); }
.await-main { flex:1; min-width:0; }
.await-head { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
.await-sub { font-size:12.5px; color: var(--text-muted,#64748b); margin-top:4px; }
.await-sups { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.sup { font-size:12px; padding:3px 8px; border-radius:999px; background: var(--surface,#fff); border:1px solid var(--border,#e5e7eb); }
.sup em { font-style:normal; font-weight:600; margin-left:4px; } .sup.more { opacity:.7; }
.await-side { display:flex; flex-direction:column; align-items:flex-end; justify-content:space-between; gap:10px; }
.amt { font-size:18px; font-weight:800; white-space:nowrap; }

.chip { font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; background: var(--surface,#fff); border:1px solid var(--border,#e5e7eb); }
.chip.co { background:#0f172a; color:#fff; border-color:#0f172a; }
.chip.mine { background:#4f46e5; color:#fff; border-color:#4f46e5; }
.chip.late { background:#fef3c7; color:#92400e; border-color:#fcd34d; }
.chip.warn { background:#fee2e2; color:#991b1b; border-color:#fca5a5; }

.runs { list-style:none; margin:0 0 12px; padding:0; display:flex; flex-direction:column; gap:10px; }
.runs li { padding:10px 12px; border-radius:10px; border:1px solid var(--border,#e5e7eb); background: var(--surface-2,#f8fafc); }
.runs li.next { border-color: rgba(79,70,229,.45); }
.rd { display:flex; align-items:center; gap:8px; } .rs { font-size:12px; color: var(--text-muted,#64748b); margin-top:2px; }
.rbar { display:flex; height:6px; border-radius:4px; overflow:hidden; background:#e2e8f0; margin-top:8px; }
.rbar .paid { background:#10b981; } .rbar .loaded { background:#0ea5e9; }
.rl { display:flex; gap:10px; font-size:11px; color: var(--text-muted,#64748b); margin-top:6px; }
.dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px; vertical-align:middle; }
.dot.paid { background:#10b981; } .dot.loaded { background:#0ea5e9; } .dot.todo { background:#cbd5e1; }
.full { width:100%; }

.chart-wrap { position:relative; height:240px; } .chart-wrap.tall { height:300px; }

.table-wrap { overflow-x:auto; }
.co-table { width:100%; border-collapse:collapse; font-size:13px; }
.co-table th, .co-table td { padding:9px 10px; border-bottom:1px solid var(--border,#e5e7eb); text-align:left; vertical-align:top; }
.co-table th { font-size:11.5px; text-transform:uppercase; letter-spacing:.04em; color: var(--text-muted,#64748b); }
.co-table .num { text-align:right; white-space:nowrap; }
.co-table .sub { font-size:11.5px; color: var(--text-muted,#64748b); }
.co-table .hot { color:#4f46e5; font-weight:700; } .co-table .warn { color:#b45309; font-weight:600; }
.sw { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:6px; }
.gen { text-align:right; font-size:11px; color: var(--text-muted,#94a3b8); margin-top:14px; }
  `]
})
export class ExecutiveComponent implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(CreditorPacksService);
  private router = inject(Router);

  @ViewChild('monthChart') monthRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('typeChart') typeRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('supplierChart') supplierRef?: ElementRef<HTMLCanvasElement>;

  d: ExecutiveOverview | null = null;
  loading = false;
  error = '';
  private charts: Chart[] = [];
  private viewReady = false;

  ngOnInit(): void { this.load(); }
  ngAfterViewInit(): void { this.viewReady = true; this.draw(); }
  ngOnDestroy(): void { this.destroyCharts(); }

  load(): void {
    this.loading = true; this.error = '';
    this.api.executive().subscribe({
      next: d => { this.d = d; this.loading = false; setTimeout(() => this.draw()); },
      error: e => { this.loading = false; this.error = e?.status === 403 ? 'Directors only' : (e?.error?.message || e?.error || 'Could not load the executive view'); }
    });
  }

  nextRun() { return this.d?.schedule.find(s => s.date === this.d?.nextPayDay); }
  pct(n: number, of: number) { return of ? Math.round(n / of * 100) : 0; }
  colour(i: number) { return COMPANY_COLOURS[i % COMPANY_COLOURS.length]; }
  scrollTo(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  openBatch(id: number) { this.router.navigate(['/finance'], { queryParams: { side: 'creditors', tab: 'creditors', batch: id } }); }
  goFinance() { this.router.navigate(['/finance'], { queryParams: { side: 'creditors', tab: 'creditors' } }); }
  goSchedule() { this.router.navigate(['/finance'], { queryParams: { side: 'creditors', tab: 'schedule' } }); }

  private destroyCharts() { this.charts.forEach(c => c.destroy()); this.charts = []; }

  private draw(): void {
    if (!this.viewReady || !this.d) return;
    this.destroyCharts();
    const d = this.d;
    const zar = (v: number) => 'R ' + Math.round(v).toLocaleString('en-ZA');
    const codes = d.perCompany.map(c => c.code);
    const colourOf = (code: string) => this.colour(Math.max(0, codes.indexOf(code)));

    // Paid per month, stacked by company
    if (this.monthRef) {
      const allCodes = Array.from(new Set(d.paidByMonth.flatMap(m => m.byCompany.map(c => c.code))));
      this.charts.push(new Chart(this.monthRef.nativeElement, {
        type: 'bar',
        data: {
          labels: d.paidByMonth.map(m => m.label),
          datasets: allCodes.map(code => ({
            label: code, backgroundColor: colourOf(code), borderRadius: 4,
            data: d.paidByMonth.map(m => m.byCompany.find(c => c.code === code)?.amount || 0)
          }))
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: v => zar(Number(v)) } } },
          plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${zar(Number(c.raw))}` } } }
        }
      }));
    }

    // Spend by type (doughnut)
    if (this.typeRef) {
      this.charts.push(new Chart(this.typeRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: d.spendByType.map(t => t.title),
          datasets: [{ data: d.spendByType.map(t => t.amount), backgroundColor: d.spendByType.map((_, i) => this.colour(i)), borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.label}: ${zar(Number(c.raw))}` } } } }
      }));
    }

    // Top suppliers (horizontal bar)
    if (this.supplierRef) {
      const top = d.topSuppliers.slice(0, 10);
      this.charts.push(new Chart(this.supplierRef.nativeElement, {
        type: 'bar',
        data: { labels: top.map(s => s.supplier), datasets: [{ label: 'Paid', data: top.map(s => s.amount), backgroundColor: '#0ea5e9', borderRadius: 4 }] },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          scales: { x: { ticks: { callback: v => zar(Number(v)) } }, y: { grid: { display: false } } },
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => { const s = top[c.dataIndex]; return `${zar(Number(c.raw))} · ${s.payments} payment${s.payments === 1 ? '' : 's'}`; } } } }
        }
      }));
    }
  }
}
