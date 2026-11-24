import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, History } from '../core/api';

/** Payment history: packs that have been paid or closed, with each payment and its proof of payment. Read-only. */
@Component({
  selector: 'app-history',
  imports: [RouterLink, CurrencyPipe, DatePipe, FormsModule],
  template: `
    <div class="head">
      <div><h1>History</h1><p class="muted">Paid and closed packs, with proof of payment.</p></div>
    </div>

    <div class="card filters">
      <div class="seg">
        @for (p of periods; track p.days) { <button type="button" [class.on]="days === p.days" (click)="days = p.days; load()">{{ p.label }}</button> }
      </div>
      <div class="fr">
        <input type="search" [(ngModel)]="q" (keyup.enter)="load()" placeholder="Search payee, pack no., reference or amount">
        @if ((h()?.companies?.length ?? 0) > 1) {
          <select [(ngModel)]="company" (change)="load()"><option value="">All companies</option>@for (c of h()!.companies; track c.code) { <option [value]="c.code">{{ c.name }}</option> }</select>
        }
        <button type="button" class="btn sm" (click)="load()" [disabled]="loading()">Search</button>
      </div>
    </div>

    @if (loading()) { <div class="spinner"></div> }
    @else if (error()) { <p class="err">{{ error() }}</p> }
    @else if (h(); as h) {
      <div class="sum">
        <span><b>{{ h.count }}</b> pack{{ h.count === 1 ? '' : 's' }}</span>
        <span><b class="amt">{{ h.total | currency:'ZAR':'R ':'1.0-0' }}</b> paid</span>
        @if (h.popMissing) { <span class="pill warn">{{ h.popMissing }} without proof of payment</span> }
      </div>
      @if (!h.batches.length) { <div class="card empty"><div class="big">🔎</div><h2>Nothing found</h2><p class="muted">No paid packs match — try a longer period or a different search.</p></div> }
      <div class="list">
        @for (b of h.batches; track b.id) {
          <div class="card pb">
            <button type="button" class="pbh" (click)="open.set(open() === b.id ? 0 : b.id)">
              <div class="l">
                <div class="co">{{ b.companyName }} <span class="pill neutral">{{ b.paymentTypeTitle }}</span> @if (b.status === 'Closed') { <span class="pill ok">Closed</span> } @else { <span class="pill warn">Paid</span> }</div>
                <div class="muted sm">{{ b.batchNumber }} · paid {{ (b.paidAt || b.closedAt) | date:'d MMM yyyy' }} · {{ b.items }} payment{{ b.items === 1 ? '' : 's' }}@if (b.directorName) { · signed by {{ b.directorName }} }</div>
                @if (b.popMissing) { <div class="muted sm">Proof of payment {{ b.popDone }}/{{ b.items }}</div> }
              </div>
              <div class="r"><b class="amt">{{ b.amount | currency:'ZAR':'R ':'1.2-2' }}</b><span class="chev">{{ open() === b.id ? '▾' : '▸' }}</span></div>
            </button>
            @if (open() === b.id) {
              <div class="lines">
                @for (i of b.lines; track i.id) {
                  <div class="ln">
                    <div><div class="sup">{{ i.supplierName }}</div><div class="muted sm">@if (i.bankName) { {{ i.bankName }} ···{{ (i.accountNumber || '').slice(-4) }} }@if (i.paymentReference) { · ref {{ i.paymentReference }} }@if (i.description) { · {{ i.description }} }</div></div>
                    <div class="r2"><b class="amt">{{ i.amount | currency:'ZAR':'R ':'1.2-2' }}</b>
                      @if (i.popDocId) { <button type="button" class="link" (click)="openPop(b.id, i.popDocId)">Proof of payment</button> } @else { <span class="muted sm">no proof</span> }</div>
                  </div>
                }
                <a class="btn ghost sm block" [routerLink]="['/pack', b.id]">Open the pack</a>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .filters { padding: 12px; display: grid; gap: 10px; margin-bottom: 14px; }
    .seg { display: flex; gap: 4px; padding: 4px; background: var(--line-2); border-radius: 12px; }
    .seg button { flex: 1; min-height: 36px; border: 0; border-radius: 9px; background: transparent; cursor: pointer; font-size: 13.5px; font-weight: 600; color: var(--muted); transition: background .15s, color .15s; } .seg button:hover { color: var(--ink); } .seg button.on { background: #fff; color: var(--brand); box-shadow: var(--shadow-sm); }
    .fr { display: flex; gap: 8px; flex-wrap: wrap; } .fr input, .fr select { flex: 1; min-width: 160px; min-height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 12px; background: #fff; font-size: 14px; } .fr input:focus, .fr select:focus { outline: none; border-color: var(--brand-2); box-shadow: 0 0 0 4px rgba(99, 102, 241, .15); }
    .sum { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin: 0 2px 12px; font-size: 14px; color: var(--ink-2); } .sum b { color: var(--ink); }
    .pb { padding: 0; overflow: hidden; }
    .pbh { width: 100%; display: flex; justify-content: space-between; gap: 12px; padding: 15px 16px; background: none; border: 0; text-align: left; cursor: pointer; color: inherit; font: inherit; transition: background .15s; } .pbh:hover { background: #fafbff; } .pbh:active { background: #f1f3ff; }
    .co { font-weight: 700; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .r { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: 0 0 auto; } .chev { color: #9ca3af; }
    .lines { border-top: 1px solid var(--line); padding: 8px 16px 14px; }
    .ln { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); } .ln:last-of-type { border-bottom: 0; margin-bottom: 10px; }
    .sup { font-weight: 600; } .r2 { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex: 0 0 auto; }
    .link { background: none; border: 0; padding: 0; color: var(--brand); font-size: 13px; cursor: pointer; text-decoration: underline; }
    .sm { font-size: 12px; }
  `]
})
export class HistoryPage implements OnInit {
  private api = inject(Api);
  periods = [{ days: 30, label: '30 days' }, { days: 90, label: '90 days' }, { days: 365, label: '12 months' }];
  days = 90; q = ''; company = '';
  h = signal<History | null>(null); loading = signal(true); error = signal(''); open = signal(0);
  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true); this.error.set('');
    const from = new Date(Date.now() - this.days * 864e5).toISOString().slice(0, 10);
    this.api.history({ from, company: this.company || undefined, q: this.q.trim() || undefined }).subscribe({
      next: h => { this.h.set(h); this.loading.set(false); },
      error: e => { this.loading.set(false); this.error.set(e?.error?.message ?? "Couldn't load the history. Check your connection and try again."); }
    });
  }
  openPop(batchId: number, docId: number) { this.api.openPdf(this.api.fileUrl(batchId, docId)); }
}
