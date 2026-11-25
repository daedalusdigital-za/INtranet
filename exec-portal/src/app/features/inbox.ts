import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api, InboxRow, QueryRow, QuoteReq } from '../core/api';
import { AuthStore } from '../core/auth';

@Component({
  selector: 'app-inbox',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  template: `
    <div class="head">
      <div><h1>Waiting for you</h1><p class="muted">Payment packs that need your {{ auth.user()?.role === 'Admin' ? 'approval or signature' : 'attention' }}.</p></div>
      <button type="button" class="icon-btn" [class.spin]="loading()" (click)="load()" [disabled]="loading()" title="Refresh" aria-label="Refresh"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg></button>
    </div>
    @if (openQueries().length) {
      <h2 class="sec">Director queries to answer</h2>
      <div class="list qlist">
        @for (q of openQueries(); track q.itemId) {
          <a class="card row q" [routerLink]="['/pack', q.batchId]">
            <div class="l">
              <div class="co">{{ q.supplierName }} <span class="pill warn">Needs an answer</span></div>
              <div class="bn">{{ q.companyName }} · {{ q.batchNumber }}@if (q.fromBatch) { · split from {{ q.fromBatch }} }</div>
              <div class="nt">❓ {{ q.question }}</div>
            </div>
            <div class="r"><div class="amt">{{ q.amount | currency:'ZAR':'R ':'1.2-2' }}</div><div class="chev">›</div></div>
          </a>
        }
      </div>
      <h2 class="sec">Packs</h2>
    }
    @if (quotes().length) {
      <h2 class="sec">Quotes to choose</h2>
      <div class="list qlist">
        @for (q of quotes(); track q.id) {
          <a class="card row qt" [routerLink]="['/quote', q.id]">
            <div class="l">
              <div class="co">{{ q.subject }} <span class="pill neutral">{{ q.files.length }} quote{{ q.files.length === 1 ? '' : 's' }}</span></div>
              <div class="bn">{{ q.company || 'Company not set' }} · {{ q.number }} · requested by {{ q.requestedBy }}</div>
              <div class="ask"><span class="pill ok">Choose a quote</span>@if (q.accountantName) { <span class="muted">approved by {{ q.accountantName }}</span> }</div>
            </div>
            <div class="r">@if (lowest(q); as lo) { <div class="amt">{{ lo | currency:'ZAR':'R ':'1.2-2' }}</div><div class="muted sm">lowest quote</div> }<div class="chev">›</div></div>
          </a>
        }
      </div>
      <h2 class="sec">Packs</h2>
    }
    @if (loading()) { <div class="spinner"></div> }
    @else if (error()) { <p class="err">{{ error() }}</p> }
    @else if (!rows().length && quotes().length) { <p class="muted">No payment packs waiting for you.</p> }
    @else if (!rows().length) {
      <div class="card empty"><div class="big">🎉</div><h2>All caught up</h2><p class="muted">Nothing is waiting for your approval or signature right now. You'll get an e-mail when a new pack is sent to you.</p></div>
    } @else {
      <div class="list">
        @for (r of rows(); track r.id) {
          <a class="card row" [class.acc]="r.role !== 'director'" [routerLink]="['/pack', r.id]">
            <div class="l">
              <div class="co">{{ r.companyName }} <span class="pill neutral">{{ r.paymentTypeTitle }}</span></div>
              <div class="bn">{{ r.batchNumber }} · {{ r.items }} payment{{ r.items === 1 ? '' : 's' }} · prepared by {{ r.preparedByName }}</div>
              @if (r.notes) { <div class="muted nt">“{{ r.notes }}”</div> }
              <div class="ask">
                @if (r.role === 'director') { <span class="pill ok">Sign as director</span> @if (r.pendingItems) { <span class="muted">{{ r.pendingItems }} to review</span> } }
                @else { <span class="pill warn">Approve as accountant</span> }
                @if (r.waitingSince) { <span class="muted">· waiting since {{ r.waitingSince | date:'d MMM, HH:mm' }}</span> }
              </div>
              @if (r.blocked) { <div class="note">{{ r.blocked }}</div> }
            </div>
            <div class="r"><div class="amt">{{ r.totalAmount | currency:'ZAR':'R ':'1.2-2' }}</div><div class="muted sm">dated {{ r.batchDate | date:'d MMM yyyy' }}</div><div class="chev">›</div></div>
          </a>
        }
      </div>
    }
  `,
  styles: [`
    .qlist { margin-bottom: 4px; } .sec:first-of-type { margin-top: 6px; }
    .row { position: relative; display: flex; gap: 14px; justify-content: space-between; text-decoration: none; color: inherit; padding: 15px 16px 15px 19px; overflow: hidden; }
    .row::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--brand); }
    .row.q::before { background: #f59e0b; } .row.acc::before { background: #0ea5e9; } .row.qt::before { background: #a855f7; }
    .row:active { background: #f8faff; }
    .co { font-weight: 700; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; } .bn { font-size: 14px; margin-top: 2px; } .nt { font-size: 14px; margin-top: 4px; }
    .ask { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; } .note { margin-top: 8px; }
    .r { text-align: right; flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; } .amt { font-weight: 700; font-size: 18px; letter-spacing: -.02em; } .sm { font-size: 12px; } .chev { font-size: 24px; color: #94a3b8; margin-top: auto; line-height: 1; transition: transform .15s; }
    a.row:hover .chev { transform: translateX(3px); color: var(--brand); }
    @media (max-width: 480px) { .row { flex-direction: column; gap: 8px; } .r { flex-direction: row; align-items: baseline; justify-content: space-between; gap: 8px; width: 100%; text-align: left; } .chev { display: none; } .bn { font-size: 13.5px; } }
  `]
})
export class InboxPage implements OnInit {
  private api = inject(Api); auth = inject(AuthStore);
  rows = signal<InboxRow[]>([]); loading = signal(true); error = signal('');
  openQueries = signal<QueryRow[]>([]);
  quotes = signal<QuoteReq[]>([]);
  ngOnInit() { this.load(); }
  lowest(q: QuoteReq): number | null { const a = q.files.map(f => f.amount).filter((x): x is number => x != null); return a.length ? Math.min(...a) : null; }
  load() {
    this.loading.set(true); this.error.set('');
    this.api.quotesForMe().subscribe({ next: q => this.quotes.set(q.filter(x => x.can?.director)), error: () => this.quotes.set([]) });
    this.api.queries().subscribe({ next: q => this.openQueries.set(q.filter(x => x.state === 'Open')), error: () => this.openQueries.set([]) });
    this.api.inbox().subscribe({
      next: r => { this.rows.set(r); this.loading.set(false); },
      error: e => { this.loading.set(false); this.error.set(e?.error?.message ?? "Couldn't load your approvals. Check your connection and try again."); }
    });
  }
}
