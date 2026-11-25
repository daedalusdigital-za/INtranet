import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api, IpBatch, IpDoc, PayBatch, PayLine, PaySchedule } from '../core/api';

type Filter = 'toLoad' | 'loaded' | 'pop' | 'overdue' | 'progress' | null;

/**
 * Pay-runs (Mondays and Wednesdays). The summary cards filter the list. Treasury works the signed packs here:
 * bank file → Loaded on bank → Mark paid → proof of payment per payment → Close. Packs still in progress are view-only.
 * Every action is checked again on the server (bank role, pack status); moving a pay-run stays on the intranet.
 */
@Component({
  selector: 'app-payruns',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  template: `
    <input #popInput type="file" accept="application/pdf,.pdf" hidden (change)="onPopFile($event)">
    <div class="head">
      <div><h1>Pay-runs</h1><p class="muted">Signed packs booked on the Monday and Wednesday runs.</p></div>
      <button type="button" class="icon-btn" [class.spin]="loading()" (click)="load()" [disabled]="loading()" title="Refresh" aria-label="Refresh"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg></button>
    </div>
    @if (msg(); as m) { <p class="toast" [class.bad]="m.bad" (click)="msg.set(null)">{{ m.text }}</p> }
    @if (loading() && !s()) { <div class="spinner"></div> }
    @else if (error()) { <p class="err">{{ error() }} <button type="button" class="link" (click)="load()">Try again</button></p> }
    @else if (s(); as s) {
      <div class="kpis">
        <button type="button" class="card kpi" [class.on]="filter() === 'toLoad'" (click)="setFilter('toLoad')"><span class="k">To load on the bank</span><b class="amt">{{ s.totals.toLoad | currency:'ZAR':'R ':'1.0-0' }}</b><span class="muted sm">{{ s.totals.toLoadCount }} pack{{ s.totals.toLoadCount === 1 ? '' : 's' }}</span></button>
        <button type="button" class="card kpi" [class.on]="filter() === 'loaded'" (click)="setFilter('loaded')"><span class="k">Loaded, not yet paid</span><b class="amt">{{ s.totals.loaded | currency:'ZAR':'R ':'1.0-0' }}</b><span class="muted sm">{{ s.totals.loadedCount }} pack{{ s.totals.loadedCount === 1 ? '' : 's' }}</span></button>
        <button type="button" class="card kpi" [class.on]="filter() === 'pop'" (click)="setFilter('pop')"><span class="k">Paid, awaiting proof</span><b class="amt">{{ s.totals.awaitingPop | currency:'ZAR':'R ':'1.0-0' }}</b><span class="muted sm">{{ s.totals.awaitingPopCount }} pack{{ s.totals.awaitingPopCount === 1 ? '' : 's' }}</span></button>
        <button type="button" class="card kpi" [class.bad]="s.totals.overdue > 0" [class.on]="filter() === 'overdue'" (click)="setFilter('overdue')"><span class="k">Overdue</span><b>{{ s.totals.overdue }}</b><span class="muted sm">past their pay-run date</span></button>
        @if (s.inProgress?.length) { <button type="button" class="card kpi ip" [class.on]="filter() === 'progress'" (click)="setFilter('progress')"><span class="k">In progress, not signed</span><b class="amt">{{ (s.totals.inProgress || 0) | currency:'ZAR':'R ':'1.0-0' }}</b><span class="muted sm">{{ s.totals.inProgressCount || 0 }} pack{{ s.totals.inProgressCount === 1 ? '' : 's' }}</span></button> }
      </div>
      @if (filter()) { <p class="filt" #listTop>Showing <b>{{ filterTitle() }}</b> · <button type="button" class="link" (click)="setFilter(null)">Show everything</button></p> }
      @else { <span #listTop></span> }
      @if (s.me?.bank) { <p class="muted sm how">Treasury: download the bank file → <b>Loaded on bank</b> → <b>Mark paid</b> → upload proof of payment for each payment → <b>Close</b>.</p> }

      @if ((filter() === null || filter() === 'progress') && s.inProgress?.length) {
        <h2 class="sec">In progress <span class="muted">· not signed yet — view only</span></h2>
        <div class="list">
          @for (p of s.inProgress; track p.id) {
            <div class="card pb ipb" [class.back]="p.sentBack">
              <button type="button" class="pbh" (click)="toggle(-p.id)">
                <div class="l">
                  <div class="co">{{ p.companyName }} <span [class]="p.sentBack ? 'pill bad' : 'pill warn'">{{ p.statusTitle }}</span></div>
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

      @if (filter() !== 'progress') {
        @if (!groups().length) {
          <div class="card empty"><div class="big">📭</div>
            @if (filter()) { <h2>Nothing here</h2><p class="muted">No packs are {{ filterTitle().toLowerCase() }} right now.</p> }
            @else { <h2>Nothing on the pay-runs</h2><p class="muted">Packs appear here once a director has signed them, and leave once they're closed with proof of payment.</p> }
          </div>
        }
        @for (g of groups(); track g.date) {
          <h2 class="sec">{{ g.date | date:'EEEE d MMMM' }} <span class="muted">· {{ g.total | currency:'ZAR':'R ':'1.0-0' }}</span></h2>
          <div class="list">
            @for (b of g.batches; track b.id) {
              <div class="card pb" [class.overdue]="b.overdue">
                <button type="button" class="pbh" (click)="toggle(b.id)">
                  <div class="l">
                    <div class="co">{{ b.companyName }} <span [class]="pill(b.status)">{{ b.statusTitle }}</span> @if (b.overdue) { <span class="pill bad">Overdue</span> }</div>
                    <div class="muted sm">{{ b.batchNumber }} · {{ b.paymentTypeTitle }} · {{ b.approvedItems }} payment{{ b.approvedItems === 1 ? '' : 's' }}@if (b.directorName) { · signed by {{ b.directorName }} }</div>
                    @if (b.status === 'Paid') { <div class="sm" [class.badtxt]="b.popMissing > 0">Proof of payment {{ b.popDone }}/{{ b.approvedItems }}</div> }
                    @if (b.bankExportedAt && b.status === 'Approved') { <div class="muted sm">Bank file downloaded {{ b.bankExportedAt | date:'d MMM HH:mm' }}</div> }
                  </div>
                  <div class="r"><b class="amt">{{ b.approvedAmount | currency:'ZAR':'R ':'1.2-2' }}</b><span class="chev">{{ open() === b.id ? '▾' : '▸' }}</span></div>
                </button>
                @if (open() === b.id) {
                  <div class="lines">
                    @if (b.can?.bankFile || b.can?.markLoaded || b.can?.markPaid || b.can?.close) {
                      <div class="acts">
                        @if (b.can?.bankFile && b.status !== 'Paid') { <button type="button" class="btn sm" (click)="save(api.bankFileUrl(b.id), b.batchNumber + '-bank.csv', true)" [disabled]="busy()">⬇ Bank file (CSV)</button> }
                        @if (b.can?.markLoaded) { <button type="button" class="btn sm" (click)="act(b, 'LoadedOnBank')" [disabled]="busy()">🏦 Loaded on bank</button> }
                        @if (b.can?.markPaid && b.status === 'LoadedOnBank') { <button type="button" class="btn ok sm" (click)="act(b, 'Paid')" [disabled]="busy()">✓ Mark paid</button> }
                        @if (b.can?.close) { <button type="button" class="btn ok sm" (click)="act(b, 'Closed')" [disabled]="busy() || b.popMissing > 0 || (b.openPrepayments || 0) > 0">Close the pack</button> }
                      </div>
                      @if (b.can?.close && b.popMissing > 0) { <p class="muted sm">Upload proof of payment for every payment below to close the pack.</p> }
                      @else if (b.can?.close && (b.openPrepayments || 0) > 0) { <p class="muted sm">Prepayments still open (tax invoice + GRV needed) — close on the intranet once they're in.</p> }
                    }
                    <div class="dls">
                      <button type="button" class="btn ghost sm" (click)="openPdf(api.reviewPdfUrl(b.id))" [disabled]="busy()">📄 Read the pack</button>
                      <button type="button" class="btn ghost sm" (click)="save(api.documentsZipUrl(b.id), 'Documents-' + b.batchNumber + '.zip')" [disabled]="busy()">⬇ All documents (ZIP)</button>
                      <button type="button" class="btn ghost sm" (click)="save(api.signedPackUrl(b.id), 'Signed-pack-' + b.batchNumber + '.pdf')" [disabled]="busy()">⬇ Signed pack (PDF)</button>
                      <button type="button" class="btn ghost sm" (click)="save(api.schedulePdfUrl(b.id), 'Payment-schedule-' + b.batchNumber + '.pdf')" [disabled]="busy()">⬇ Payment schedule</button>
                      <button type="button" class="btn ghost sm" (click)="save(api.approvalSheetUrl(b.id), 'Approval-sheet-' + b.batchNumber + '.pdf')" [disabled]="busy()">⬇ Approval sheet</button>
                    </div>
                    @for (i of b.items; track i.id) {
                      <div class="ln">
                        <div><div class="sup">{{ i.supplierName }}</div><div class="muted sm">@if (i.bankName) { {{ i.bankName }} ···{{ (i.accountNumber || '').slice(-4) }} }@if (i.paymentReference) { · ref {{ i.paymentReference }} }</div></div>
                        <div class="r2"><b class="amt">{{ i.amount | currency:'ZAR':'R ':'1.2-2' }}</b>
                          <button type="button" class="link" (click)="openPdf(api.itemReviewUrl(b.id, i.id))">Preview</button>
                          @if (i.popDocId) { <button type="button" class="link ok" (click)="openPdf(api.fileUrl(b.id, i.popDocId))">✓ Proof of payment</button> }
                          @else if (b.status === 'Paid' && b.can?.uploadPop) { <button type="button" class="btn ghost sm" (click)="pickPop(b, i)" [disabled]="busy()">{{ uploading() === i.id ? 'Uploading…' : '⬆ Upload proof' }}</button> }
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
      }
      <p class="muted sm foot">Moving a pay-run to another day is done on the intranet.</p>
    }
  `,
  styles: [`
    .kpi.on { border-color: #a5b4fc; background: linear-gradient(135deg, #eef2ff, #fff 75%); box-shadow: 0 0 0 1px #a5b4fc, var(--shadow); } .kpi.ip { border-style: dashed; }
    .filt { margin: 12px 0 0; font-size: 14px; } .how { margin: 10px 0 0; }
    .toast { position: sticky; top: 56px; z-index: 4; background: var(--ok-bg); color: var(--ok); border: 1px solid #a7f3d0; padding: 11px 14px; border-radius: 12px; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: var(--shadow); } .toast.bad { background: var(--bad-bg); color: var(--bad); border-color: #fecaca; }
    @media (max-width: 759px) { .toast { top: 8px; } }
    .ipb { border-style: dashed; } .ipb.back { border-color: var(--bad); }
    .steps { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 2px; } .steps span { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--bg); color: var(--muted); } .steps span.done { background: var(--ok-bg); color: var(--ok); } .steps span.now { background: var(--warn-bg); color: var(--warn); font-weight: 700; }
    .acts { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0 8px; }
    .dls { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 10px; }
    .docs { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; } .doc { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 5px 10px; font-size: 12px; cursor: pointer; color: inherit; }
    .note { margin: 0 0 10px; } .badtxt { color: var(--bad); font-weight: 600; }
    .pb { padding: 0; overflow: hidden; } .pb.overdue { border-color: var(--bad); }
    .pbh { width: 100%; display: flex; justify-content: space-between; gap: 12px; padding: 15px 16px; background: none; border: 0; text-align: left; cursor: pointer; color: inherit; font: inherit; transition: background .15s; } .pbh:hover { background: #fafbff; } .pbh:active { background: #f1f3ff; }
    .acts .btn { flex: 1 1 auto; } @media (min-width: 760px) { .acts .btn { flex: 0 0 auto; } }
    .co { font-weight: 700; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .r { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: 0 0 auto; } .chev { color: #9ca3af; }
    .lines { border-top: 1px solid var(--line); padding: 8px 16px 14px; }
    .ln { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); } .ln:last-of-type { border-bottom: 0; margin-bottom: 10px; }
    .sup { font-weight: 600; } .r2 { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: 0 0 auto; }
    .link { background: none; border: 0; padding: 0; color: var(--brand); font-size: 13px; cursor: pointer; text-decoration: underline; } .link.ok { color: var(--ok); }
    .sm { font-size: 12px; } .foot { text-align: center; margin-top: 18px; }
    .empty { margin-top: 14px; }
  `]
})
export class PayrunsPage implements OnInit {
  api = inject(Api);
  private popInput = viewChild<ElementRef<HTMLInputElement>>('popInput');
  private listTop = viewChild<ElementRef<HTMLElement>>('listTop');
  s = signal<PaySchedule | null>(null); loading = signal(true); error = signal(''); open = signal(0); busy = signal(false);
  filter = signal<Filter>(null); uploading = signal(0);
  msg = signal<{ text: string; bad?: boolean } | null>(null);
  private pendingPop: { b: PayBatch; i: PayLine } | null = null;
  readonly stepNames = ['Preparing', 'Accountant', 'Director', 'Signed'];

  filterTitle = computed(() => ({ toLoad: 'To load on the bank', loaded: 'Loaded, not yet paid', pop: 'Paid, awaiting proof', overdue: 'Overdue', progress: 'In progress, not signed' } as Record<string, string>)[this.filter() ?? ''] ?? '');
  groups = computed(() => {
    const f = this.filter();
    const keep = (b: PayBatch) => f === 'toLoad' ? b.status === 'Approved' : f === 'loaded' ? b.status === 'LoadedOnBank' : f === 'pop' ? b.status === 'Paid' : f === 'overdue' ? b.overdue : true;
    const m = new Map<string, PayBatch[]>();
    for (const b of (this.s()?.batches ?? []).filter(keep)) { const k = (b.scheduledPayDate || '').slice(0, 10); m.set(k, [...(m.get(k) ?? []), b]); }
    return [...m.entries()].sort(([a], [c]) => a.localeCompare(c)).map(([date, batches]) => ({ date, batches, total: batches.reduce((n, b) => n + b.approvedAmount, 0) }));
  });

  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true); this.error.set('');
    this.api.schedule().subscribe({
      next: s => { this.s.set(s); this.loading.set(false); },
      error: async e => { this.loading.set(false); this.error.set(await Api.errorText(e, "Couldn't load the pay-runs. Check your connection and try again.")); }
    });
  }
  setFilter(f: Filter) {
    const next = this.filter() === f ? null : f;
    this.filter.set(next); this.open.set(0);
    // Open the pack straight away when the filter leaves just one.
    if (next && next !== 'progress') { const g = this.groups(); if (g.length === 1 && g[0].batches.length === 1) this.open.set(g[0].batches[0].id); }
    if (next) setTimeout(() => this.listTop()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }
  toggle(id: number) { this.open.set(this.open() === id ? 0 : id); }
  pill(status: string) { return 'pill ' + (status === 'Paid' ? 'ok' : status === 'LoadedOnBank' ? 'neutral' : 'warn'); }
  openPdf(url: string) { this.busy.set(true); this.api.openPdf(url, () => this.busy.set(false)); }
  /** Spreadsheets (recons) can't be shown on a phone — they download; everything else opens. */
  openDoc(batchId: number, d: IpDoc) {
    const name = d.originalFileName || d.title;
    if (/\.(xlsx|xls|csv)$/i.test(name || '')) this.save(this.api.fileUrl(batchId, d.id), name!);
    else this.openPdf(this.api.fileUrl(batchId, d.id));
  }
  save(url: string, name: string, reload = false) {
    this.busy.set(true);
    this.api.download(url, name, ok => { this.busy.set(false); if (ok && reload) this.refreshQuietly(); });
  }

  act(b: PayBatch, to: 'LoadedOnBank' | 'Paid' | 'Closed') {
    const ask = to === 'LoadedOnBank' ? `Mark ${b.batchNumber} as loaded on the bank?`
      : to === 'Paid' ? `Mark ${b.batchNumber} as paid (R ${b.approvedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })})? The preparer is told to upload proof of payment.`
      : `Close ${b.batchNumber}? Every payment has its proof of payment.`;
    if (!confirm(ask)) return;
    this.busy.set(true);
    this.api.setStatus(b.id, to).subscribe({
      next: () => {
        this.busy.set(false);
        this.msg.set({ text: to === 'LoadedOnBank' ? `${b.batchNumber} is loaded on the bank.` : to === 'Paid' ? `${b.batchNumber} is marked paid — upload the proofs of payment to close it.` : `${b.batchNumber} is closed.` });
        this.refreshQuietly(b.id);
      },
      error: async e => { this.busy.set(false); this.msg.set({ text: await Api.errorText(e, "Couldn't update the pack."), bad: true }); }
    });
  }

  pickPop(b: PayBatch, i: PayLine) { this.pendingPop = { b, i }; const el = this.popInput()?.nativeElement; if (el) { el.value = ''; el.click(); } }
  onPopFile(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    const p = this.pendingPop; this.pendingPop = null;
    if (!file || !p) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { this.msg.set({ text: 'Proof of payment must be a PDF.', bad: true }); return; }
    if (file.size > 20 * 1024 * 1024) { this.msg.set({ text: 'That file is larger than 20 MB.', bad: true }); return; }
    this.busy.set(true); this.uploading.set(p.i.id);
    this.api.uploadPop(p.b.id, p.i.id, file).subscribe({
      next: () => { this.busy.set(false); this.uploading.set(0); this.msg.set({ text: `Proof of payment uploaded for ${p.i.supplierName}.` }); this.refreshQuietly(p.b.id); },
      error: async e => { this.busy.set(false); this.uploading.set(0); this.msg.set({ text: await Api.errorText(e, "Couldn't upload the proof of payment."), bad: true }); }
    });
  }

  /** Reload without blanking the page, keeping the pack open. */
  private refreshQuietly(keepOpen?: number) {
    this.api.schedule().subscribe({
      next: s => { this.s.set(s); if (keepOpen && s.batches.some(x => x.id === keepOpen)) this.open.set(keepOpen); },
      error: () => { }
    });
  }

  whereNow(p: IpBatch): string {
    if (p.sentBack) return `Sent back to ${p.preparedByName || 'the preparer'} to fix.`;
    if (p.stage === 1) return `With ${p.requestedApproverNames || 'the accountant'} to approve.`;
    if (p.stage === 2) return `Approved by ${p.accountantName || 'the accountant'} — with ${p.requestedDirectorNames || 'the director'} to sign.`;
    return `Being prepared by ${p.preparedByName || 'the preparer'}.`;
  }
}
