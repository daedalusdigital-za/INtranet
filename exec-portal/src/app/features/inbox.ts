import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api, InboxRow, QueryRow } from '../core/api';
import { AuthStore } from '../core/auth';

@Component({
  selector: 'app-inbox',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  template: `
    <div class="head">
      <div><h1>Waiting for you</h1><p class="muted">Payment packs that need your {{ auth.user()?.role === 'Admin' ? 'approval or signature' : 'attention' }}.</p></div>
      <button type="button" class="btn ghost sm" (click)="load()" [disabled]="loading()">Refresh</button>
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
    @if (loading()) { <div class="spinner"></div> }
    @else if (error()) { <p class="err">{{ error() }}</p> }
    @else if (!rows().length) {
      <div class="card empty"><div class="big">🎉</div><h2>All caught up</h2><p class="muted">Nothing is waiting for your approval or signature right now. You'll get an e-mail when a new pack is sent to you.</p></div>
    } @else {
      <div class="list">
        @for (r of rows(); track r.id) {
          <a class="card row" [routerLink]="['/pack', r.id]">
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
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; } h1 { margin: 0 0 4px; font-size: 22px; } .head p { margin: 0; }
    .list { display: grid; gap: 10px; } .qlist { margin-bottom: 8px; } .row.q { border-left: 5px solid var(--warn); }
    .sec { font-size: 15px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 14px 0 8px; }
    .row { display: flex; gap: 14px; justify-content: space-between; text-decoration: none; color: inherit; padding: 14px 16px; }
    .row:active { background: #eef2ff; }
    .co { font-weight: 700; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; } .bn { font-size: 14px; margin-top: 2px; } .nt { font-size: 14px; margin-top: 4px; }
    .ask { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; } .note { margin-top: 8px; }
    .r { text-align: right; flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; } .amt { font-weight: 700; font-size: 18px; } .sm { font-size: 12px; } .chev { font-size: 26px; color: #9ca3af; margin-top: auto; line-height: 1; }
    .empty { text-align: center; padding: 40px 20px; } .big { font-size: 40px; } .empty h2 { margin: 8px 0 4px; }
  `]
})
export class InboxPage implements OnInit {
  private api = inject(Api); auth = inject(AuthStore);
  rows = signal<InboxRow[]>([]); loading = signal(true); error = signal('');
  openQueries = signal<QueryRow[]>([]);
  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true); this.error.set('');
    this.api.queries().subscribe({ next: q => this.openQueries.set(q.filter(x => x.state === 'Open')), error: () => this.openQueries.set([]) });
    this.api.inbox().subscribe({
      next: r => { this.rows.set(r); this.loading.set(false); },
      error: e => { this.loading.set(false); this.error.set(e?.error?.message ?? "Couldn't load your approvals. Check your connection and try again."); }
    });
  }
}
