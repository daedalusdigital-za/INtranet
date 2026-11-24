import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api, IpBatch, IpDoc, PayBatch, PaySchedule } from '../core/api';

/**
 * Pay-runs (Mondays and Wednesdays): packs still in progress (read-only), signed packs waiting to be loaded, paid or closed with
 * proof of payment. Treasury can read and download every document here; moving a pay-run, the bank file and marking paid stay on the intranet.
 */
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
        @if (s.inProgress?.length) { <div class="card kpi ip"><span class="k">In progress, not signed</span><b class="amt">{{ (s.totals.inProgress || 0) | currency:'ZAR':'R ':'1.0-0' }}</b><span class="muted sm">{{ s.totals.inProgressCount || 0 }} pack{{ s.totals.inProgressCount === 1 ? '' : 's' }}</span></div> }
      </div>

      @if (s.inProgress?.length) {
        <h2 class="sec">In progress <span class="muted">· not signed yet — view only</span></h2>
        <div class="list">
          @for (p of s.inProgress; track p.id) {
            <div class="card pb ipb" [class.back]="p.sentBack">
              <button type="button" class="pbh" (click)="toggle(-p.id)">
                <div class="l">
                  <div class="co">{{ p.companyName }} <span class="pill" [class]="p.sentBack ? 'pill bad' : 'pill warn'">{{ p.statusTitle }}</span></div>
                  <div class="muted sm">{{ p.batchNumber }} · {{ p.paymentTypeTitle }} · {{ p.itemCount }} payment{{ p.itemCount === 1 ? '' : 's' }} · {{ p.documentCount }} document{{ p.documentCount === 1 ? '' : 's' }}</div>
                  <div class="steps">@for (st of stepNames; track $index) { <span [class.done]="$index < p.stage" [class.now]="$index === p.stage">{{ st }}</span> }</div>
                  <div class="muted sm">{{ whereNow(p) }}</div>
                </div>
                <div class="r"><b class="amt">{{ p.amount | currency:'ZAR':'R ':'1.2-2' }}</b><span class="muted sm">for {{ p.expectedPayDate | date:'EEE d MMM' }}</span><span class="chev">{{ open() === -p.id ? '▾' : '▸' }}</span></div>
              </button>
              @if (open() === -p.id) {
                <div class="lines">
                  @if (p.returnReason) { <p class="note">{{ p.returnReason }}</p> }
                  <button type="button" class="btn ghost sm block" (click)="openPdf(api.reviewPdfUrl(p.id))" [disabled]="busy()">📄 Read the whole pack (PDF)</button>
                  @if (p.batchDocuments.length) { <div class="docs">@for (d of p.batchDocuments; track d.id) { <button type="button" class="doc" (click)="openDoc(p.id, d)">📎 {{ d.title }}</button> }</div> }
                  @for (i of p.items; track i.id) {
                    <div class="ln">
                      <div><div class="sup">{{ i.supplierName }}</div>@if (i.invoiceNumbers) { <div class="muted sm">Inv {{ i.invoiceNumbers }}</div> }
                        <div class="docs">@for (d of i.documents; track d.id) { <button type="button" class="doc" (click)="openDoc(p.id, d)">📎 {{ d.title }}</button> } @empty { <span class="muted sm">Nothing uploaded yet</span> }</div></div>
                      <div class="r2"><b class="amt">{{ i.amount | currency:'ZAR':'R ':'1.2-2' }}</b>@if (i.documents.length) { <button type="button" class="link" (click)="openPdf(api.itemReviewUrl(p.id, i.id))">Preview</button> }</div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

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
                  <div class="dls">
                    <button type="button" class="btn ghost sm" (click)="openPdf(api.reviewPdfUrl(b.id))" [disabled]="busy()">📄 Read the pack</button>
                    <button type="button" class="btn ghost sm" (click)="save(api.documentsZipUrl(b.id), 'Documents-' + b.batchNumber + '.zip')" [disabled]="busy()">⬇ All documents (ZIP)</button>
                    <button type="button" class="btn ghost sm" (click)="save(api.signedPackUrl(b.id), 'Signed-pack-' + b.batchNumber + '.pdf')" [disabled]="busy()">⬇ Signed pack (PDF)</button>
                    <button type="button" class="btn ghost sm" (click)="save(api.schedulePdfUrl(b.id), 'Payment-schedule-' + b.batchNumber + '.pdf')" [disabled]="busy()">⬇ Payment schedule</button>
                  </div>
                  @for (i of b.items; track i.id) {
                    <div class="ln">
                      <div><div class="sup">{{ i.supplierName }}</div><div class="muted sm">@if (i.bankName) { {{ i.bankName }} ···{{ (i.accountNumber || '').slice(-4) }} }@if (i.paymentReference) { · ref {{ i.paymentReference }} }</div></div>
                      <div class="r2"><b class="amt">{{ i.amount | currency:'ZAR':'R ':'1.2-2' }}</b>
                        <button type="button" class="link" (click)="openPdf(api.itemReviewUrl(b.id, i.id))">Preview</button>
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
      <p class="muted sm foot">The bank file (CSV), moving a pay-run, loading on the bank and marking paid are done on the intranet.</p>
    }
  `,
  styles: [`
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; } h1 { margin: 0 0 4px; font-size: 22px; } .head p { margin: 0; }
    .kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } @media (min-width: 720px) { .kpis { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); } }
    .kpi.ip { border-style: dashed; }
    .ipb { border-style: dashed; } .ipb.back { border-color: var(--bad); }
    .steps { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 2px; } .steps span { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--bg); color: var(--muted); } .steps span.done { background: var(--ok-bg); color: var(--ok); } .steps span.now { background: var(--warn-bg); color: var(--warn); font-weight: 700; }
    .dls { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 10px; }
    .docs { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; } .doc { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 5px 10px; font-size: 12px; cursor: pointer; color: inherit; }
    .note { margin: 0 0 10px; }
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
  api = inject(Api);
  s = signal<PaySchedule | null>(null); loading = signal(true); error = signal(''); open = signal(0); busy = signal(false);
  readonly stepNames = ['Preparing', 'Accountant', 'Director', 'Signed'];
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
  openPdf(url: string) { this.busy.set(true); this.api.openPdf(url, () => this.busy.set(false)); }
  /** Spreadsheets (recons) can't be shown on a phone — they download; everything else opens. */
  openDoc(batchId: number, d: IpDoc) {
    const name = d.originalFileName || d.title;
    if (/\.(xlsx|xls|csv)$/i.test(name || '')) this.save(this.api.fileUrl(batchId, d.id), name!);
    else this.openPdf(this.api.fileUrl(batchId, d.id));
  }
  save(url: string, name: string) { this.busy.set(true); this.api.download(url, name, () => this.busy.set(false)); }
  whereNow(p: IpBatch): string {
    if (p.sentBack) return `Sent back to ${p.preparedByName || 'the preparer'} to fix.`;
    if (p.stage === 1) return `With ${p.requestedApproverNames || 'the accountant'} to approve.`;
    if (p.stage === 2) return `Approved by ${p.accountantName || 'the accountant'} — with ${p.requestedDirectorNames || 'the director'} to sign.`;
    return `Being prepared by ${p.preparedByName || 'the preparer'}.`;
  }
}
