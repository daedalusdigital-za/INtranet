import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api, PayBatch, PaySchedule } from '../core/api';

/** Pay-runs (Mondays and Wednesdays): signed packs waiting to be loaded, paid or closed with proof of payment. View-only — moving a pay-run or marking paid stays on the intranet. */
@Component({
  selector: 'app-payruns',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  template: `
    <div class="head">
      <div><h1>Pay-runs</h1><p class="muted">Signed packs booked on the Monday and Wednesday runs.</p></div>
      <button type="button" class="btn ghost sm" (click)="load()" [disabled]="loading()">Refresh</button>
    </div>
    @if (loading()) { <div class="spinner"></div> }
    @else if (error()) { <p class="err">{{ error() }}</p> }
    @else if (s(); as s) {
      <div class="kpis">
        <div class="card kpi"><span class="k">To load on the bank</span><b class="amt">{{ s.totals.toLoad | currency:'ZAR':'R ':'1.0-0' }}</b><span class="muted sm">{{ s.totals.toLoadCount }} pack{{ s.totals.toLoadCount === 1 ? '' : 's' }}</span></div>
        <div class="card kpi"><span class="k">Loaded, not yet paid</span><b class="amt">{{ s.totals.loaded | currency:'ZAR':'R ':'1.0-0' }}</b><span class="muted sm">{{ s.totals.loadedCount }} pack{{ s.totals.loadedCount === 1 ? '' : 's' }}</span></div>
        <div class="card kpi"><span class="k">Paid, awaiting proof</span><b class="amt">{{ s.totals.awaitingPop | currency:'ZAR':'R ':'1.0-0' }}</b><span class="muted sm">{{ s.totals.awaitingPopCount }} pack{{ s.totals.awaitingPopCount === 1 ? '' : 's' }}</span></div>
        <div class="card kpi" [class.bad]="s.totals.overdue > 0"><span class="k">Overdue</span><b>{{ s.totals.overdue }}</b><span class="muted sm">past their pay-run date</span></div>
      </div>

      @if (!s.batches.length) {
        <div class="card empty"><div class="big">📭</div><h2>Nothing on the pay-runs</h2><p class="muted">Packs appear here once a director has signed them, and leave once they're closed with proof of payment.</p></div>
      }
      @for (g of groups(); track g.date) {
        <h2 class="sec">{{ g.date | date:'EEEE d MMMM' }} <span class="muted">· {{ g.total | currency:'ZAR':'R ':'1.0-0' }}</span></h2>
        <div class="list">
          @for (b of g.batches; track b.id) {
            <div class="card pb" [class.overdue]="b.overdue">
              <button type="button" class="pbh" (click)="toggle(b.id)">
                <div class="l">
                  <div class="co">{{ b.companyName }} <span class="pill" [class]="pill(b.status)">{{ b.statusTitle }}</span> @if (b.overdue) { <span class="pill bad">Overdue</span> }</div>
                  <div class="muted sm">{{ b.batchNumber }} · {{ b.paymentTypeTitle }} · {{ b.approvedItems }} payment{{ b.approvedItems === 1 ? '' : 's' }}@if (b.directorName) { · signed by {{ b.directorName }} }</div>
                  @if (b.popMissing && b.status === 'Paid') { <div class="muted sm">Proof of payment {{ b.popDone }}/{{ b.approvedItems }}</div> }
                </div>
                <div class="r"><b class="amt">{{ b.approvedAmount | currency:'ZAR':'R ':'1.2-2' }}</b><span class="chev">{{ open() === b.id ? '▾' : '▸' }}</span></div>
              </button>
              @if (open() === b.id) {
                <div class="lines">
                  @for (i of b.items; track i.id) {
                    <div class="ln">
                      <div><div class="sup">{{ i.supplierName }}</div><div class="muted sm">@if (i.bankName) { {{ i.bankName }} ···{{ (i.accountNumber || '').slice(-4) }} }@if (i.paymentReference) { · ref {{ i.paymentReference }} }</div></div>
                      <div class="r2"><b class="amt">{{ i.amount | currency:'ZAR':'R ':'1.2-2' }}</b>
                        @if (i.popDocId) { <button type="button" class="link" (click)="openPop(b.id, i.popDocId)">Proof of payment</button> }
                        @else if (b.status === 'Paid') { <span class="muted sm">no proof yet</span> }</div>
                    </div>
                  }
                  <a class="btn ghost sm block" [routerLink]="['/pack', b.id]">Open the pack</a>
                </div>
              }
            </div>
          }
        </div>
      }
      <p class="muted sm foot">Moving a pay-run, loading on the bank and marking paid are done on the intranet.</p>
    }
  `,
  styles: [`
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; } h1 { margin: 0 0 4px; font-size: 22px; } .head p { margin: 0; }
    .kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } @media (min-width: 720px) { .kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
    .kpi { display: flex; flex-direction: column; gap: 2px; padding: 14px; } .kpi .k { font-size: 13px; color: var(--muted); font-weight: 600; } .kpi b { font-size: 20px; } .kpi.bad b { color: var(--bad); }
    .sec { font-size: 16px; margin: 22px 0 8px; } .sec .muted { font-weight: 400; }
    .list { display: grid; gap: 10px; }
    .pb { padding: 0; overflow: hidden; } .pb.overdue { border-color: var(--bad); }
    .pbh { width: 100%; display: flex; justify-content: space-between; gap: 12px; padding: 14px 16px; background: none; border: 0; text-align: left; cursor: pointer; color: inherit; } .pbh:active { background: #eef2ff; }
    .co { font-weight: 700; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .r { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: 0 0 auto; } .chev { color: #9ca3af; }
    .lines { border-top: 1px solid var(--line); padding: 8px 16px 14px; }
    .ln { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); } .ln:last-of-type { border-bottom: 0; margin-bottom: 10px; }
    .sup { font-weight: 600; } .r2 { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex: 0 0 auto; }
    .link { background: none; border: 0; padding: 0; color: var(--brand); font-size: 13px; cursor: pointer; text-decoration: underline; }
    .sm { font-size: 12px; } .foot { text-align: center; margin-top: 18px; }
    .empty { text-align: center; padding: 40px 20px; margin-top: 14px; } .big { font-size: 40px; } .empty h2 { margin: 8px 0 4px; }
  `]
})
export class PayrunsPage implements OnInit {
  private api = inject(Api);
  s = signal<PaySchedule | null>(null); loading = signal(true); error = signal(''); open = signal(0);
  groups = computed(() => {
    const m = new Map<string, PayBatch[]>();
    for (const b of this.s()?.batches ?? []) { const k = (b.scheduledPayDate || '').slice(0, 10); m.set(k, [...(m.get(k) ?? []), b]); }
    return [...m.entries()].sort(([a], [c]) => a.localeCompare(c)).map(([date, batches]) => ({ date, batches, total: batches.reduce((n, b) => n + b.approvedAmount, 0) }));
  });
  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true); this.error.set('');
    this.api.schedule().subscribe({
      next: s => { this.s.set(s); this.loading.set(false); },
      error: e => { this.loading.set(false); this.error.set(e?.error?.message ?? "Couldn't load the pay-runs. Check your connection and try again."); }
    });
  }
  toggle(id: number) { this.open.set(this.open() === id ? 0 : id); }
  pill(status: string) { return 'pill ' + (status === 'Paid' ? 'ok' : status === 'LoadedOnBank' ? 'neutral' : 'warn'); }
  openPop(batchId: number, docId: number) { this.api.openPdf(this.api.fileUrl(batchId, docId)); }
}
