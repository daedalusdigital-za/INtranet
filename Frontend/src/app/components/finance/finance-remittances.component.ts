import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';

interface Attachment { id: number; fileName: string; contentType?: string; size: number; isPdf: boolean; hasText?: boolean; }
interface Remit {
  id: number; mailbox: string; fromName?: string; fromEmail?: string; subject?: string; receivedAt: string; matchedOn?: string;
  customerCode?: string; customerName?: string; invoiceCount: number; matchedCount: number; totalAmount?: number; matchedBalance?: number;
  status: 'New' | 'Reviewed' | 'Allocated' | 'Ignored'; notes?: string; reviewedAt?: string; attachments: Attachment[];
}
interface Inv { invoiceNumber: string; amount?: number; source: string; inAging: boolean; customerCode?: string; customerName?: string; agingBalance?: number; daysOver?: number; company?: string; hasPod: boolean; shortPaid: boolean; }
interface Detail extends Remit { bodyText?: string; messageId?: string; extraction: { paymentDate?: string; paymentReference?: string; amounts: number[]; invoices: Inv[] }; }
interface Scan { id: number; startedAt: string; finishedAt?: string; mailboxes?: string; messagesChecked: number; remittancesFound: number; trigger: string; error?: string; }
interface ListResp { mailboxes: string[]; keywords: string[]; lastScan?: Scan; counts: { status: string; n: number }[]; items: Remit[]; }

@Component({
  selector: 'app-finance-remittances',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
    <div class="rm-toolbar">
      <div class="rm-status">
        @for (s of statuses; track s) {
          <button class="rm-chip" [class.active]="status() === s" (click)="status.set(s); load()">
            {{ s }} <span class="n">{{ countFor(s) }}</span>
          </button>
        }
      </div>
      <input class="rm-search" type="search" placeholder="Search sender, subject, customer, invoice no, file…" [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="load()" />
      <span class="rm-spacer"></span>
      <button mat-stroked-button (click)="scanNow()" [disabled]="scanning()" matTooltip="Check the finance mailbox for new remittance emails right now">
        <mat-icon>{{ scanning() ? 'hourglass_top' : 'mark_email_read' }}</mat-icon> {{ scanning() ? 'Scanning…' : 'Scan mailbox now' }}
      </button>
    </div>

    <div class="rm-meta">
      <mat-icon>schedule</mat-icon>
      <span>Watching <b>{{ mailboxes().join(', ') || '—' }}</b> every night at 00:00 for emails mentioning <i>{{ keywords().slice(0, 5).join(', ') }}…</i></span>
      @if (lastScan(); as ls) {
        <span class="sep">•</span>
        <span>Last scan {{ ls.startedAt | date:'dd MMM HH:mm' }} ({{ ls.trigger }}): {{ ls.messagesChecked }} emails checked, {{ ls.remittancesFound }} new
          @if (ls.error) { <span class="err" [matTooltip]="ls.error">— failed</span> }</span>
      } @else { <span class="sep">•</span><span>Not scanned yet</span> }
    </div>

    @if (loading()) { <div class="rm-center"><mat-spinner diameter="36"></mat-spinner></div> }
    @else if (items().length === 0) {
      <div class="rm-empty"><mat-icon>inbox</mat-icon><p>No remittances {{ status() === 'All' ? '' : 'in "' + status() + '"' }} yet. Run <b>Scan mailbox now</b> or wait for the nightly sweep.</p></div>
    } @else {
      <div class="rm-tablewrap">
        <table class="rm-table">
          <thead><tr><th>Received</th><th>From</th><th>Subject</th><th>Customer</th><th>Attachments</th><th class="r">Invoices</th><th class="r">Amount</th><th>Status</th></tr></thead>
          <tbody>
            @for (r of items(); track r.id) {
              <tr [class.sel]="detail()?.id === r.id" [class.unread]="r.status === 'New'" (click)="open(r)">
                <td class="nowrap">{{ r.receivedAt | date:'dd MMM yy HH:mm' }}</td>
                <td><div class="from">{{ r.fromName || r.fromEmail }}</div><div class="sub">{{ r.fromEmail }}</div></td>
                <td class="subj">{{ r.subject || '(no subject)' }}</td>
                <td>@if (r.customerName) { <span class="cust" [matTooltip]="r.customerCode || ''">{{ r.customerName }}</span> } @else { <span class="muted">unmatched</span> }</td>
                <td>
                  <div class="atts">
                    @for (a of r.attachments; track a.id) {
                      <button class="att" [class.pdf]="a.isPdf" (click)="view(r, a); $event.stopPropagation()" [matTooltip]="a.fileName + ' · ' + fmtSize(a.size)">
                        <mat-icon>{{ a.isPdf ? 'picture_as_pdf' : 'attach_file' }}</mat-icon><span>{{ shortName(a.fileName) }}</span>
                      </button>
                    }
                    @if (r.attachments.length === 0) { <span class="muted">none</span> }
                  </div>
                </td>
                <td class="r nowrap">
                  @if (r.invoiceCount) { <span [class.ok]="r.matchedCount === r.invoiceCount" [class.warn]="r.matchedCount < r.invoiceCount">{{ r.matchedCount }}/{{ r.invoiceCount }}</span> } @else { <span class="muted">—</span> }
                </td>
                <td class="r nowrap">{{ r.totalAmount ? (r.totalAmount | currency:'ZAR':'R':'1.2-2') : '—' }}</td>
                <td><span class="st" [ngClass]="r.status.toLowerCase()">{{ r.status }}</span></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <!-- Detail drawer (overlay, independent of the tab's scroll container) -->
    @if (detail(); as d) {
      <div class="rm-backdrop" (click)="detail.set(null)"></div>
      <aside class="rm-detail" role="dialog" aria-label="Remittance detail">
            <div class="d-head">
              <div class="d-title">
                <h3>{{ d.subject || '(no subject)' }}</h3>
                <div class="sub">From <b>{{ d.fromName || d.fromEmail }}</b> &lt;{{ d.fromEmail }}&gt;</div>
                <div class="sub">{{ d.receivedAt | date:'EEE dd MMM yyyy HH:mm' }} · to {{ d.mailbox }}</div>
                @if (d.matchedOn) { <div class="sub">Picked up because — {{ d.matchedOn }}</div> }
              </div>
              <button mat-icon-button (click)="detail.set(null)" aria-label="Close"><mat-icon>close</mat-icon></button>
            </div>

            <div class="d-body">
            <div class="d-status">
              @for (s of ['New','Reviewed','Allocated','Ignored']; track s) {
                <button class="rm-chip" [class.active]="d.status === s" (click)="setStatus(d, s)">{{ s }}</button>
              }
              <span class="rm-spacer"></span>
              @if (d.reviewedAt) { <span class="muted">updated {{ d.reviewedAt | date:'dd MMM HH:mm' }}</span> }
            </div>

            <!-- Summary cards -->
            <div class="d-cards">
              <div class="c"><span class="l">Customer</span><span class="v">{{ d.customerName || 'Not matched' }}</span><span class="s">{{ d.customerCode || 'no aging match' }}</span></div>
              <div class="c"><span class="l">Remittance total</span><span class="v">{{ d.totalAmount ? (d.totalAmount | currency:'ZAR':'R':'1.2-2') : '—' }}</span><span class="s">{{ d.extraction.paymentReference ? 'ref ' + d.extraction.paymentReference : '' }} {{ d.extraction.paymentDate ? '· ' + d.extraction.paymentDate : '' }}</span></div>
              <div class="c"><span class="l">Aging balance (matched)</span><span class="v">{{ d.matchedBalance ? (d.matchedBalance | currency:'ZAR':'R':'1.2-2') : '—' }}</span>
                <span class="s" [class.ok]="variance(d) === 0" [class.warn]="variance(d) !== 0">{{ varianceText(d) }}</span></div>
              <div class="c"><span class="l">Invoices</span><span class="v">{{ d.matchedCount }}/{{ d.invoiceCount }}</span><span class="s">found in aging</span></div>
            </div>

            <!-- Attachments -->
            <h4>Attachments ({{ d.attachments.length }})</h4>
            <div class="d-atts">
              @for (a of d.attachments; track a.id) {
                <div class="d-att">
                  <mat-icon [class.pdf]="a.isPdf">{{ a.isPdf ? 'picture_as_pdf' : 'attach_file' }}</mat-icon>
                  <div class="n"><div>{{ a.fileName }}</div><div class="sub">{{ fmtSize(a.size) }} {{ a.hasText ? '· text read' : '' }}</div></div>
                  <button mat-icon-button matTooltip="Open" (click)="view(d, a)"><mat-icon>open_in_new</mat-icon></button>
                  <button mat-icon-button matTooltip="Download" (click)="download(d, a)"><mat-icon>download</mat-icon></button>
                </div>
              }
              @if (d.attachments.length === 0) { <div class="muted">No attachments — details are in the email body below.</div> }
            </div>

            <!-- Invoices -->
            <h4>Invoices on this remittance</h4>
            @if (d.extraction.invoices.length === 0) {
              <div class="muted">No invoice numbers (IN######) could be read from the email or its PDFs. Open the attachment to allocate manually.</div>
            } @else {
              <table class="inv">
                <thead><tr><th>Invoice</th><th class="r">Paid</th><th class="r">Aging balance</th><th>Age</th><th>Customer (aging)</th><th>POD</th><th>Seen in</th></tr></thead>
                <tbody>
                  @for (i of d.extraction.invoices; track i.invoiceNumber) {
                    <tr [class.miss]="!i.inAging">
                      <td class="mono">{{ i.invoiceNumber }}</td>
                      <td class="r">{{ i.amount != null ? (i.amount | currency:'ZAR':'R':'1.2-2') : '—' }}</td>
                      <td class="r nowrap">
                        @if (i.inAging) {
                          <span>{{ i.agingBalance | currency:'ZAR':'R':'1.2-2' }}</span>
                          @if (i.shortPaid) { <mat-icon class="warn-ic" matTooltip="Paid less than the outstanding balance">warning</mat-icon> }
                        } @else { <span class="muted">not in aging</span> }
                      </td>
                      <td>{{ i.inAging ? ((i.daysOver || 0) > 0 ? i.daysOver + 'd over' : 'current') : '' }}</td>
                      <td>{{ i.customerName || '' }} <span class="sub">{{ i.company || '' }}</span></td>
                      <td>@if (i.hasPod) { <mat-icon class="ok-ic" matTooltip="POD on file">task_alt</mat-icon> } @else { <span class="muted">—</span> }</td>
                      <td class="sub">{{ i.source }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }

            <!-- Email body -->
            <h4>Email</h4>
            <pre class="body">{{ d.bodyText || '(empty body)' }}</pre>

            <h4>Finance notes</h4>
            <textarea class="notes" rows="3" [(ngModel)]="notesDraft" placeholder="e.g. Allocated in Sage on 12 Nov, short-paid IN123456 by R250 – queried with customer"></textarea>
            <div class="notes-actions"><button mat-flat-button color="primary" (click)="saveNotes(d)">Save notes</button></div>
            </div>
      </aside>
    }
  `,
  styles: [`
    :host { display:block; }
    .rm-toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px; }
    .rm-status { display:flex; gap:6px; flex-wrap:wrap; }
    .rm-chip { border:1px solid #d0d7de; background:#fff; border-radius:999px; padding:4px 12px; cursor:pointer; font-size:12.5px; display:inline-flex; gap:6px; align-items:center; }
    .rm-chip .n { background:#eef1f4; border-radius:999px; padding:0 6px; font-size:11px; }
    .rm-chip.active { background:#1f3b63; color:#fff; border-color:#1f3b63; } .rm-chip.active .n { background:rgba(255,255,255,.2); }
    .rm-search { flex:1 1 260px; max-width:420px; padding:7px 10px; border:1px solid #d0d7de; border-radius:6px; }
    .rm-spacer { flex:1; }
    .rm-meta { display:flex; align-items:center; gap:8px; font-size:12.5px; color:#555; margin:4px 0 12px; flex-wrap:wrap; }
    .rm-meta mat-icon { font-size:18px; width:18px; height:18px; } .rm-meta .sep { opacity:.5; } .rm-meta .err { color:#b42318; font-weight:600; }
    .rm-center { display:flex; justify-content:center; padding:40px; }
    .rm-empty { text-align:center; padding:48px 16px; color:#666; } .rm-empty mat-icon { font-size:44px; width:44px; height:44px; opacity:.4; }
    .rm-tablewrap { overflow-x:auto; border:1px solid #e3e7eb; border-radius:8px; background:#fff; }
    .rm-table { width:100%; border-collapse:collapse; font-size:13px; min-width:980px; }
    .rm-table th { text-align:left; padding:8px 10px; background:#f6f8fa; font-weight:600; font-size:12px; color:#444; border-bottom:1px solid #e3e7eb; white-space:nowrap; }
    .rm-table td { padding:8px 10px; border-bottom:1px solid #f0f2f4; vertical-align:middle; }
    .rm-table tbody tr:last-child td { border-bottom:0; }
    .rm-table tbody tr { cursor:pointer; } .rm-table tbody tr:hover { background:#f8fafc; } .rm-table tr.sel { background:#eaf1fb; } .rm-table tr.unread .from, .rm-table tr.unread .subj { font-weight:600; }
    .subj { max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .r { text-align:right; } .nowrap { white-space:nowrap; } .muted { color:#999; } .sub { color:#777; font-size:11.5px; } .mono { font-family:ui-monospace,monospace; }
    .ok { color:#1a7f37; font-weight:600; } .warn { color:#b54708; font-weight:600; }
    .atts { display:flex; flex-wrap:wrap; gap:4px; max-width:260px; }
    .att { display:inline-flex; align-items:center; gap:3px; border:1px solid #d0d7de; background:#fff; border-radius:4px; padding:2px 6px; font-size:11.5px; cursor:pointer; max-width:180px; line-height:1.4; }
    .att span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .att mat-icon { font-size:15px; width:15px; height:15px; line-height:15px; } .att.pdf mat-icon { color:#c62828; } .att:hover { background:#f0f4f8; }
    .st { display:inline-block; border-radius:4px; padding:2px 8px; font-size:11.5px; font-weight:600; white-space:nowrap; }
    .st.new { background:#fff4e5; color:#b54708; } .st.reviewed { background:#e8f0fe; color:#1a56db; } .st.allocated { background:#e6f4ea; color:#1a7f37; } .st.ignored { background:#f0f0f0; color:#777; }

    /* Drawer */
    .rm-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.35); z-index:1000; animation:rmFade .15s ease-out; }
    .rm-detail { position:fixed; top:0; right:0; bottom:0; width:min(680px, 100vw); background:#fff; z-index:1001; display:flex; flex-direction:column; box-shadow:-8px 0 30px rgba(0,0,0,.18); animation:rmSlide .2s ease-out; }
    @keyframes rmSlide { from { transform:translateX(40px); opacity:0; } to { transform:none; opacity:1; } }
    @keyframes rmFade { from { opacity:0; } to { opacity:1; } }
    .d-head { display:flex; justify-content:space-between; gap:8px; align-items:flex-start; padding:16px 16px 12px 20px; border-bottom:1px solid #e3e7eb; background:#f8fafc; flex:0 0 auto; }
    .d-title { min-width:0; } .d-head h3 { margin:0 0 4px; font-size:15px; line-height:1.3; word-break:break-word; }
    .d-body { flex:1 1 auto; overflow-y:auto; padding:12px 20px 24px; min-height:0; }
    .d-status { display:flex; gap:6px; align-items:center; margin:0 0 12px; flex-wrap:wrap; }
    .d-cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-bottom:12px; }
    .c { border:1px solid #e3e7eb; border-radius:6px; padding:8px 10px; display:flex; flex-direction:column; min-width:0; } .c .l { font-size:11px; color:#777; text-transform:uppercase; } .c .v { font-size:15px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .c .s { font-size:11.5px; color:#777; }
    h4 { margin:16px 0 6px; font-size:13px; color:#333; }
    .d-att { display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid #f0f2f4; } .d-att .n { flex:1; font-size:13px; min-width:0; word-break:break-all; } .d-att mat-icon.pdf { color:#c62828; }
    .inv { width:100%; border-collapse:collapse; font-size:12.5px; } .inv th { text-align:left; font-size:11.5px; color:#555; padding:4px 6px; border-bottom:1px solid #e3e7eb; white-space:nowrap; } .inv td { padding:5px 6px; border-bottom:1px solid #f0f2f4; vertical-align:middle; }
    .inv tr.miss td { background:#fff8f6; } .warn-ic { font-size:16px; width:16px; height:16px; color:#b54708; vertical-align:middle; margin-left:2px; } .ok-ic { font-size:18px; width:18px; height:18px; color:#1a7f37; }
    .body { white-space:pre-wrap; word-break:break-word; background:#f8f9fa; border:1px solid #e3e7eb; border-radius:6px; padding:10px; font:12.5px/1.45 ui-monospace,Consolas,monospace; max-height:320px; overflow:auto; margin:0; }
    .notes { width:100%; box-sizing:border-box; border:1px solid #d0d7de; border-radius:6px; padding:8px; font:inherit; resize:vertical; } .notes-actions { margin-top:6px; text-align:right; }
    .cust { font-weight:500; }
  `]
})
export class FinanceRemittancesComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private api = `${environment.apiUrl}/finance/remittances`;

  statuses = ['All', 'New', 'Reviewed', 'Allocated', 'Ignored'];
  status = signal('All');
  search = signal('');
  loading = signal(false);
  scanning = signal(false);
  items = signal<Remit[]>([]);
  counts = signal<{ status: string; n: number }[]>([]);
  mailboxes = signal<string[]>([]);
  keywords = signal<string[]>([]);
  lastScan = signal<Scan | null>(null);
  detail = signal<Detail | null>(null);
  notesDraft = '';

  ngOnInit(): void { this.load(); }
  @HostListener('document:keydown.escape') onEsc(): void { if (this.detail()) this.detail.set(null); }

  load(): void {
    this.loading.set(true);
    let p = new HttpParams().set('status', this.status());
    if (this.search().trim()) p = p.set('search', this.search().trim());
    this.http.get<ListResp>(this.api, { params: p }).subscribe({
      next: r => { this.items.set(r.items); this.counts.set(r.counts); this.mailboxes.set(r.mailboxes); this.keywords.set(r.keywords); this.lastScan.set(r.lastScan ?? null); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Could not load remittances'); }
    });
  }
  countFor(s: string): number { return s === 'All' ? this.counts().reduce((a, c) => a + c.n, 0) : (this.counts().find(c => c.status === s)?.n ?? 0); }

  open(r: Remit): void {
    this.http.get<Detail>(`${this.api}/${r.id}`).subscribe({ next: d => { this.detail.set(d); this.notesDraft = d.notes || ''; }, error: () => this.toast.error('Could not open remittance') });
  }
  view(r: Remit, a: Attachment): void {
    this.http.get(`${this.api}/${r.id}/attachments/${a.id}`, { responseType: 'blob' }).subscribe({
      next: b => window.open(URL.createObjectURL(new Blob([b], { type: a.contentType || b.type })), '_blank'),
      error: () => this.toast.error('Attachment is missing from storage')
    });
  }
  download(r: Remit, a: Attachment): void {
    this.http.get(`${this.api}/${r.id}/attachments/${a.id}`, { params: { download: true }, responseType: 'blob' }).subscribe({
      next: b => { const el = document.createElement('a'); el.href = URL.createObjectURL(b); el.download = a.fileName; el.click(); URL.revokeObjectURL(el.href); },
      error: () => this.toast.error('Download failed')
    });
  }
  setStatus(d: Detail, status: string): void {
    this.http.put<{ status: Remit['status']; notes?: string; reviewedAt: string }>(`${this.api}/${d.id}/status`, { status, notes: this.notesDraft }).subscribe({
      next: r => { this.detail.set({ ...d, status: r.status, notes: r.notes, reviewedAt: r.reviewedAt }); this.items.update(l => l.map(x => x.id === d.id ? { ...x, status: r.status, notes: r.notes, reviewedAt: r.reviewedAt } : x)); this.refreshCounts(); this.toast.done(`Marked ${status}`); },
      error: () => this.toast.error('Could not update status')
    });
  }
  saveNotes(d: Detail): void { this.setStatus(d, d.status); }
  private refreshCounts(): void {
    const m = new Map<string, number>(); for (const r of this.items()) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    // only reliable when viewing "All"; otherwise reload counts from server
    if (this.status() === 'All') this.counts.set([...m].map(([status, n]) => ({ status, n }))); else this.load();
  }
  scanNow(): void {
    this.scanning.set(true);
    this.http.post<Scan>(`${this.api}/scan`, {}).subscribe({
      next: s => { this.scanning.set(false); this.toast.done(`Checked ${s.messagesChecked} emails, ${s.remittancesFound} new remittance${s.remittancesFound === 1 ? '' : 's'}`); this.load(); },
      error: e => { this.scanning.set(false); this.toast.error(e?.error?.message || 'Mailbox scan failed'); this.load(); }
    });
  }
  variance(d: Detail): number { if (!d.totalAmount || !d.matchedBalance) return 0; return Math.round((d.totalAmount - d.matchedBalance) * 100) / 100; }
  varianceText(d: Detail): string {
    if (!d.totalAmount || !d.matchedBalance) return 'no comparison'; const v = this.variance(d);
    return v === 0 ? 'matches remittance exactly' : v < 0 ? `short-paid by R${Math.abs(v).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : `over-paid by R${v.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  }
  fmtSize(b: number): string { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b > 1024 ? Math.round(b / 1024) + ' KB' : b + ' B'; }
  shortName(n: string): string { return n.length > 22 ? n.slice(0, 12) + '…' + n.slice(-8) : n; }
}
