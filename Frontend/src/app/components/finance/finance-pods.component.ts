import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { UploaderDialogComponent } from '../uploader/uploader-dialog.component';

interface PodInvoiceLink { id: number; invoiceId?: number | null; invoiceNumber?: string | null; linkedAt: string; }
interface Pod {
  id: number; podNumber?: string; driverId?: number | null; driverName: string; deliveryDate: string; region?: string;
  fileName?: string; originalFileName?: string; contentType?: string; fileSize?: number; notes?: string;
  uploadedAt: string; createdAt: string; loadId?: number | null; loadNumber?: string | null;
  invoiceId?: number | null; invoiceNumber?: string | null; invoiceLinks: PodInvoiceLink[];
}
interface PodSummary {
  total: number; linked: number; unlinked: number; linkedToTripsheet: number; linkedToInvoice: number;
  byRegion: { region: string; count: number }[];
  byMonth: { year: number; month: number; count: number }[];
  drivers: { driverName: string; count: number }[];
  dateRange?: { earliest: string; latest: string } | null;
}

/**
 * Finance → PODs.
 * A proof of delivery is what lets Finance invoice and collect. This register shows every POD,
 * which invoices it covers, and — most importantly — the ones that cover nothing yet.
 */
@Component({
  selector: 'app-finance-pods',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule, MatPaginatorModule, MatDialogModule, MatMenuModule],
  template: `
    <!-- KPIs -->
    <div class="fp-kpis">
      <button class="fp-kpi" [class.active]="linkStatus() === ''" (click)="setLink('')">
        <mat-icon>fact_check</mat-icon>
        <span class="v">{{ summary()?.total ?? 0 }}</span>
        <span class="l">All PODs</span>
      </button>
      <button class="fp-kpi ok" [class.active]="linkStatus() === 'linked'" (click)="setLink('linked')">
        <mat-icon>link</mat-icon>
        <span class="v">{{ summary()?.linked ?? 0 }}</span>
        <span class="l">Linked to invoice / tripsheet</span>
      </button>
      <button class="fp-kpi warn" [class.active]="linkStatus() === 'not-linked'" (click)="setLink('not-linked')">
        <mat-icon>link_off</mat-icon>
        <span class="v">{{ summary()?.unlinked ?? 0 }}</span>
        <span class="l">Unlinked — not yet billable</span>
      </button>
      <div class="fp-kpi static">
        <mat-icon>receipt_long</mat-icon>
        <span class="v">{{ summary()?.linkedToInvoice ?? 0 }}</span>
        <span class="l">Covering an invoice</span>
      </div>
      <div class="fp-kpi static">
        <mat-icon>local_shipping</mat-icon>
        <span class="v">{{ summary()?.linkedToTripsheet ?? 0 }}</span>
        <span class="l">On a tripsheet</span>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="fp-toolbar">
      <div class="fp-search">
        <mat-icon>search</mat-icon>
        <input type="text" placeholder="Invoice #, POD #, driver, file…" [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="reload()" />
        @if (search()) { <button aria-label="Clear" mat-icon-button (click)="search.set(''); reload()"><mat-icon>close</mat-icon></button> }
      </div>
      <select [ngModel]="region()" (ngModelChange)="region.set($event); reload()" aria-label="Region">
        <option value="">All regions</option>
        @for (r of regions(); track r) { <option [value]="r">{{ r }}</option> }
      </select>
      <select [ngModel]="driver()" (ngModelChange)="driver.set($event); reload()" aria-label="Driver">
        <option value="">All drivers</option>
        @for (d of summary()?.drivers ?? []; track d.driverName) { <option [value]="d.driverName">{{ d.driverName }} ({{ d.count }})</option> }
      </select>
      <select [ngModel]="monthKey()" (ngModelChange)="monthKey.set($event); reload()" aria-label="Month">
        <option value="">All months</option>
        @for (m of summary()?.byMonth ?? []; track m.year + '-' + m.month) {
          <option [value]="m.year + '-' + m.month">{{ monthLabel(m.year, m.month) }} ({{ m.count }})</option>
        }
      </select>
      <span class="fp-spacer"></span>
      <button mat-stroked-button class="fp-welly" (click)="wellyScanUnlinked()" [disabled]="wellyRunning()"
              matTooltip="Welly reads every unlinked POD, finds the invoice numbers on the page and links the ones it reads exactly">
        <mat-icon>{{ wellyRunning() ? 'hourglass_top' : 'auto_awesome' }}</mat-icon>
        {{ wellyRunning() ? 'Welly scanning…' : 'Welly: scan unlinked' }}
      </button>
      <button mat-stroked-button (click)="reconcile()" matTooltip="Match PODs to tripsheets and invoices by number">
        <mat-icon>sync</mat-icon> Reconcile
      </button>
      <button mat-flat-button color="primary" (click)="upload()">
        <mat-icon>upload_file</mat-icon> Upload PODs
      </button>
    </div>

    <!-- Welly scan panel -->
    @if (wellyRunning() || wellyResults().length) {
      <div class="fp-welly-panel">
        <div class="head">
          <mat-icon>auto_awesome</mat-icon>
          <div class="txt">
            <b>{{ wellyRunning() ? 'Welly is reading the unlinked PODs' : 'Welly finished' }}</b>
            <small>{{ wellyStatus() }}</small>
          </div>
          @if (wellyRunning()) {
            <button mat-stroked-button (click)="wellyStop = true">Stop after this batch</button>
          } @else {
            <button aria-label="Close" mat-icon-button (click)="wellyResults.set([])"><mat-icon>close</mat-icon></button>
          }
        </div>
        @if (wellyRunning()) { <div class="bar"><div class="fill" [style.width.%]="wellyProgress()"></div></div> }
        @if (wellyResults().length) {
          <table class="app-table fp-welly-table">
            <thead><tr><th>POD</th><th>Driver</th><th>Linked</th><th>Needs a look</th><th>Not an invoice we know</th></tr></thead>
            <tbody>
              @for (r of wellyResults(); track r.podId) {
                <tr [class.ok]="r.linked > 0" [class.err]="!!r.error">
                  <td><span class="ref">{{ r.podNumber }}</span><small>{{ r.fileName }}</small></td>
                  <td>{{ r.driverName || '—' }}</td>
                  <td>
                    @if (r.linked > 0) { <div class="fp-chips">@for (n of r.linkedNumbers; track n) { <span class="fp-chip ok">{{ n }}</span> }</div> }
                    @else if (r.error) { <span class="badge warn">{{ r.error }}</span> }
                    @else { <span class="muted">nothing read exactly</span> }
                  </td>
                  <td>
                    @if (r.suggested?.length) {
                      <div class="fp-chips">@for (n of r.suggested; track n) { <button class="fp-chip sug" (click)="linkSuggested(r, n)" matTooltip="Read with OCR corrections — click to link if it's right">{{ n }} <mat-icon>add_link</mat-icon></button> }</div>
                    } @else { <span class="muted">—</span> }
                  </td>
                  <td><small class="muted">{{ (r.unmatched || []).slice(0, 4).join(', ') || '—' }}</small></td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    }

    <!-- Table -->
    <div class="fp-table-wrap">
      @if (loading()) {
        <div class="fp-state"><mat-spinner diameter="36"></mat-spinner><p>Loading PODs…</p></div>
      } @else if (rows().length === 0) {
        <div class="fp-state">
          <mat-icon>inbox</mat-icon>
          <h3>No PODs match</h3>
          <p>Try clearing a filter, or upload the delivery notes from the drivers.</p>
        </div>
      } @else {
        <table class="app-table fp-table">
          <thead>
            <tr>
              <th>POD</th>
              <th>Delivered</th>
              <th>Driver</th>
              <th>Region</th>
              <th>Invoices covered</th>
              <th>Tripsheet</th>
              <th>Status</th>
              <th class="actions"></th>
            </tr>
          </thead>
          <tbody>
            @for (p of rows(); track p.id) {
              <tr [class.unlinked]="!isLinked(p)">
                <td>
                  <div class="fp-cell-main">
                    <mat-icon class="fp-file" [class.img]="isImage(p)">{{ isImage(p) ? 'image' : 'picture_as_pdf' }}</mat-icon>
                    <div>
                      <span class="ref">{{ p.podNumber || ('POD-' + p.id) }}</span>
                      <small>{{ p.originalFileName || p.fileName || '—' }}</small>
                    </div>
                  </div>
                </td>
                <td><span class="nowrap">{{ p.deliveryDate | date:'dd MMM yyyy' }}</span></td>
                <td>{{ p.driverName || '—' }}</td>
                <td>{{ p.region || '—' }}</td>
                <td>
                  @if (invoiceNumbers(p).length) {
                    <div class="fp-chips">
                      @for (n of invoiceNumbers(p); track n) { <span class="fp-chip">{{ n }}</span> }
                    </div>
                  } @else { <span class="muted">None</span> }
                </td>
                <td>@if (p.loadNumber) { <span class="ref">{{ p.loadNumber }}</span> } @else { <span class="muted">—</span> }</td>
                <td>
                  @if (isLinked(p)) { <span class="badge ok">Linked</span> } @else { <span class="badge warn">Unlinked</span> }
                </td>
                <td class="actions">
                  <button aria-label="View" mat-icon-button matTooltip="View" (click)="view(p)"><mat-icon>visibility</mat-icon></button>
                  <button aria-label="Download" mat-icon-button matTooltip="Download" (click)="download(p)"><mat-icon>download</mat-icon></button>
                  <button aria-label="More" mat-icon-button [matMenuTriggerFor]="m"><mat-icon>more_vert</mat-icon></button>
                  <mat-menu #m="matMenu">
                    <button mat-menu-item (click)="linkInvoices(p)"><mat-icon>add_link</mat-icon> Link invoice numbers…</button>
                    @if (p.invoiceLinks?.length || p.invoiceId) {
                      <button mat-menu-item (click)="delinkInvoices(p)"><mat-icon>link_off</mat-icon> Remove invoice links</button>
                    }
                    <button mat-menu-item (click)="editNotes(p)"><mat-icon>notes</mat-icon> Edit notes</button>
                  </mat-menu>
                </td>
              </tr>
            }
          </tbody>
        </table>
        <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="pageIndex()" [pageSizeOptions]="[25, 50, 100]" (page)="onPage($event)" showFirstLastButtons></mat-paginator>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .fp-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-4); }
    .fp-kpi {
      display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: var(--space-3) var(--space-4); text-align: left;
      background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); cursor: pointer; font: inherit; color: var(--color-text);
      transition: border-color .15s, box-shadow .15s;
      mat-icon { color: var(--color-primary); margin-bottom: 4px; }
      .v { font-size: var(--text-3xl); font-weight: 700; line-height: 1.1; }
      .l { font-size: var(--text-xs); color: var(--color-text-3); }
      &:hover:not(.static) { border-color: var(--color-primary); box-shadow: var(--shadow-sm); }
      &.active { border-color: var(--color-primary); background: var(--color-primary-soft); }
      &.ok mat-icon { color: var(--color-ok); } &.ok.active { background: var(--color-ok-soft); border-color: var(--color-ok); }
      &.warn mat-icon { color: var(--color-warn); } &.warn.active { background: var(--color-warn-soft); border-color: var(--color-warn); }
      &.static { cursor: default; mat-icon { color: var(--color-text-3); } }
    }
    .fp-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3);
      select { height: 40px; padding: 0 var(--space-3); border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; }
    }
    .fp-search { display: flex; align-items: center; gap: 6px; height: 40px; padding: 0 var(--space-2) 0 var(--space-3); min-width: 280px; flex: 1 1 280px; max-width: 460px;
      border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface);
      mat-icon { color: var(--color-text-3); }
      input { flex: 1; border: 0; outline: 0; background: transparent; color: var(--color-text); font: inherit; }
      &:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
    }
    .fp-spacer { flex: 1; }
    .fp-welly mat-icon { color: var(--color-cat-purple, #8b5cf6); }
    .fp-welly-panel { margin-bottom: var(--space-3); padding: var(--space-3) var(--space-4); background: var(--color-surface); border: 1px solid var(--color-line); border-left: 4px solid var(--color-cat-purple, #8b5cf6); border-radius: var(--radius-md);
      .head { display: flex; align-items: center; gap: var(--space-3); mat-icon { color: var(--color-cat-purple, #8b5cf6); } .txt { flex: 1; display: flex; flex-direction: column; } small { color: var(--color-text-3); } }
      .bar { height: 6px; margin-top: var(--space-2); border-radius: 999px; background: var(--color-surface-2); overflow: hidden; .fill { height: 100%; background: var(--color-cat-purple, #8b5cf6); transition: width .3s; } }
      .fp-welly-table { width: 100%; margin-top: var(--space-3); border-collapse: collapse;
        th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; color: var(--color-text-3); padding: 6px var(--space-2); border-bottom: 1px solid var(--color-line); }
        td { padding: 6px var(--space-2); border-bottom: 1px solid var(--color-line); font-size: var(--text-sm); vertical-align: top; small { display: block; color: var(--color-text-3); font-size: var(--text-xs); } }
        tr.ok td:first-child { box-shadow: inset 3px 0 0 var(--color-ok); }
        tr.err td:first-child { box-shadow: inset 3px 0 0 var(--color-warn); } }
      .fp-chip.ok { background: var(--color-ok-soft); color: var(--color-ok); }
      .fp-chip.sug { border: 1px dashed var(--color-warn); background: var(--color-warn-soft); color: var(--color-warn); cursor: pointer; font: inherit; font-family: var(--font-mono); font-size: var(--text-xs); display: inline-flex; align-items: center; gap: 2px; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
    }
    .fp-table-wrap { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); overflow: hidden; }
    .fp-table { width: 100%; border-collapse: collapse;
      th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); padding: 10px var(--space-3); background: var(--color-surface-2); border-bottom: 1px solid var(--color-line); }
      td { padding: var(--row-pad-y) var(--space-3); border-bottom: 1px solid var(--color-line); vertical-align: middle; font-size: var(--text-sm); }
      tr.unlinked td:first-child { box-shadow: inset 3px 0 0 var(--color-warn); }
      .actions { text-align: right; white-space: nowrap; }
    }
    .fp-cell-main { display: flex; align-items: center; gap: var(--space-2);
      small { display: block; color: var(--color-text-3); font-size: var(--text-xs); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }
    .fp-file { color: var(--color-danger); &.img { color: var(--color-cat-teal); } }
    .ref { font-family: var(--font-mono); font-size: .95em; }
    .nowrap { white-space: nowrap; }
    .muted { color: var(--color-text-3); }
    .fp-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .fp-chip { padding: 2px 8px; border-radius: 999px; background: var(--color-primary-soft); color: var(--color-primary); font-family: var(--font-mono); font-size: var(--text-xs); }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: var(--text-xs); font-weight: 600;
      &.ok { background: var(--color-ok-soft); color: var(--color-ok); } &.warn { background: var(--color-warn-soft); color: var(--color-warn); } }
    .fp-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-4); color: var(--color-text-3); text-align: center;
      mat-icon { font-size: 44px; width: 44px; height: 44px; } h3 { margin: 0; color: var(--color-text); } p { margin: 0; } }
  `]
})
export class FinancePodsComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);
  private api = environment.apiUrl;

  summary = signal<PodSummary | null>(null);
  rows = signal<Pod[]>([]);
  total = signal(0);
  loading = signal(false);
  pageIndex = signal(0);
  pageSize = signal(50);

  search = signal('');
  region = signal('');
  driver = signal('');
  monthKey = signal('');
  linkStatus = signal<'' | 'linked' | 'not-linked'>('');

  regions = computed(() => (this.summary()?.byRegion ?? []).map(r => r.region).filter(Boolean).sort());

  ngOnInit(): void { this.loadSummary(); this.reload(); }

  loadSummary(): void {
    this.http.get<PodSummary>(`${this.api}/PodDocuments/summary`).subscribe({ next: s => this.summary.set(s), error: () => {} });
  }

  reload(): void {
    this.loading.set(true);
    let params = new HttpParams().set('page', this.pageIndex() + 1).set('pageSize', this.pageSize());
    if (this.region()) params = params.set('region', this.region());
    if (this.driver()) params = params.set('driverName', this.driver());
    if (this.linkStatus()) params = params.set('linkStatus', this.linkStatus());
    if (this.monthKey()) { const [y, m] = this.monthKey().split('-'); params = params.set('year', y).set('month', m); }
    this.http.get<{ data: Pod[]; total: number }>(`${this.api}/PodDocuments`, { params }).subscribe({
      next: r => {
        let data = r.data ?? [];
        const q = this.search().trim().toLowerCase();
        if (q) {
          data = data.filter(p =>
            (p.podNumber ?? '').toLowerCase().includes(q) ||
            (p.driverName ?? '').toLowerCase().includes(q) ||
            (p.originalFileName ?? p.fileName ?? '').toLowerCase().includes(q) ||
            (p.loadNumber ?? '').toLowerCase().includes(q) ||
            this.invoiceNumbers(p).some(n => n.toLowerCase().includes(q)));
        }
        this.rows.set(data); this.total.set(q ? data.length : r.total ?? data.length); this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.error("Couldn't load PODs. Try again."); }
    });
  }

  setLink(v: '' | 'linked' | 'not-linked'): void { this.linkStatus.set(v); this.pageIndex.set(0); this.reload(); }
  onPage(e: PageEvent): void { this.pageIndex.set(e.pageIndex); this.pageSize.set(e.pageSize); this.reload(); }

  monthLabel(y: number, m: number): string { return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); }
  isImage(p: Pod): boolean { return (p.contentType ?? '').startsWith('image/'); }
  isLinked(p: Pod): boolean { return !!(p.loadId || p.invoiceId || p.invoiceLinks?.length); }
  invoiceNumbers(p: Pod): string[] {
    const s = new Set<string>();
    if (p.invoiceNumber) s.add(p.invoiceNumber);
    for (const l of p.invoiceLinks ?? []) if (l.invoiceNumber) s.add(l.invoiceNumber);
    return [...s];
  }

  view(p: Pod): void {
    this.http.get(`${this.api}/PodDocuments/${p.id}/view`, { responseType: 'blob' }).subscribe({
      next: b => window.open(URL.createObjectURL(b), '_blank'),
      error: () => this.toast.error("Couldn't open the POD file.")
    });
  }
  download(p: Pod): void {
    this.http.get(`${this.api}/PodDocuments/${p.id}/download`, { responseType: 'blob' }).subscribe({
      next: b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = p.originalFileName || p.fileName || `POD-${p.id}`; a.click(); URL.revokeObjectURL(a.href); },
      error: () => this.toast.error("Couldn't download the POD file.")
    });
  }

  upload(): void {
    this.dialog.open(UploaderDialogComponent, { width: 'min(1100px, 94vw)', maxHeight: '92vh', panelClass: 'uploader-dialog-panel', data: { mode: 'pod' } })
      .afterClosed().subscribe(() => { this.loadSummary(); this.reload(); });
  }

  reconcile(): void {
    this.toast.info('Matching PODs to tripsheets and invoices…');
    this.http.post<any>(`${this.api}/PodDocuments/reconcile-tripsheets`, {}).subscribe({
      next: r => { this.toast.done(r?.message || `Reconciled: ${r?.podsLinked ?? 0} POD(s) linked`); this.loadSummary(); this.reload(); },
      error: () => this.toast.error("Reconcile failed. Try again.")
    });
  }

  // ── Welly: scan unlinked PODs on the server and link the invoice numbers it reads exactly ──
  wellyRunning = signal(false);
  wellyStatus = signal('');
  wellyProgress = signal(0);
  wellyResults = signal<any[]>([]);
  wellyStop = false;

  async wellyScanUnlinked(): Promise<void> {
    const unlinked = this.summary()?.unlinked ?? 0;
    if (unlinked === 0) { this.toast.info('There are no unlinked PODs to scan.'); return; }
    const scoped = !!(this.region() || this.driver());
    if (!window.confirm(`Welly will read ${scoped ? 'the unlinked PODs in the current region/driver filter' : `all ${unlinked} unlinked POD(s)`}, find the invoice numbers on each page and link the ones it reads exactly.\n\nNumbers it had to guess at are shown for you to confirm. Continue?`)) return;

    this.wellyRunning.set(true);
    this.wellyStop = false;
    this.wellyResults.set([]);
    this.wellyProgress.set(0);
    this.wellyStatus.set('Starting…');

    const excludeIds: number[] = [];
    let done = 0, linked = 0, remaining = unlinked;
    try {
      while (!this.wellyStop) {
        const body: any = { limit: 5, autoLink: true, excludeIds };
        if (this.region()) body.region = this.region();
        if (this.driver()) body.driverName = this.driver();
        const r: any = await this.http.post(`${this.api}/PodDocuments/welly-scan-unlinked`, body).toPromise();
        const results: any[] = r?.results ?? [];
        if (results.length === 0) break;
        for (const x of results) excludeIds.push(x.podId);
        done += results.length;
        linked += r?.linked ?? 0;
        remaining = r?.remaining ?? 0;
        this.wellyResults.set([...this.wellyResults(), ...results]);
        const total = done + remaining;
        this.wellyProgress.set(total ? Math.round((done / total) * 100) : 100);
        this.wellyStatus.set(`${done} POD(s) read · ${linked} invoice(s) linked · ${remaining} to go`);
        if (remaining === 0) break;
      }
      this.wellyStatus.set(`${done} POD(s) read · ${linked} invoice(s) linked` + (this.wellyStop && remaining > 0 ? ` · stopped with ${remaining} left` : ''));
      this.toast.done(`Welly linked ${linked} invoice(s) across ${done} POD(s)`);
    } catch (e: any) {
      const msg = e?.error?.error || e?.error?.message || e?.message || 'unknown error';
      this.wellyStatus.set('Welly stopped: ' + msg);
      this.toast.error('Welly could not scan: ' + msg);
    } finally {
      this.wellyRunning.set(false);
      this.loadSummary(); this.reload();
    }
  }

  /** Link one OCR-corrected suggestion after the user confirms it. */
  linkSuggested(r: any, invoiceNumber: string): void {
    this.http.post<{ matches: { id: number; transactionNumber?: string }[] }>(`${this.api}/PodDocuments/match-invoice-numbers`, { candidates: [invoiceNumber] }).subscribe({
      next: m => {
        const id = m.matches?.[0]?.id;
        if (!id) { this.toast.warn(`Invoice ${invoiceNumber} not found`); return; }
        this.http.put(`${this.api}/PodDocuments/${r.podId}/link-invoices`, { invoiceIds: [id] }).subscribe({
          next: () => {
            r.linked = (r.linked || 0) + 1;
            r.linkedNumbers = [...(r.linkedNumbers || []), invoiceNumber];
            r.suggested = (r.suggested || []).filter((n: string) => n !== invoiceNumber);
            this.wellyResults.set([...this.wellyResults()]);
            this.toast.done(`Linked ${invoiceNumber} to ${r.podNumber}`);
            this.loadSummary(); this.reload();
          },
          error: (e) => this.toast.error(e?.error?.message || e?.error || "Couldn't link the invoice.")
        });
      },
      error: () => this.toast.error("Couldn't look up that invoice number.")
    });
  }

  linkInvoices(p: Pod): void {
    const current = this.invoiceNumbers(p).join(', ');
    const input = window.prompt('Invoice numbers this POD covers (comma separated):', current);
    if (input === null) return;
    const candidates = input.split(/[,\s;]+/).map(s => s.trim()).filter(Boolean);
    if (!candidates.length) return;
    // Resolve numbers → invoice IDs (tolerates OCR-style mis-reads), then link.
    this.http.post<{ matches: { id: number; transactionNumber?: string }[]; unmatched: string[] }>(`${this.api}/PodDocuments/match-invoice-numbers`, { candidates }).subscribe({
      next: r => {
        const ids = (r.matches ?? []).map(m => m.id).filter(Boolean);
        if (!ids.length) { this.toast.warn(`No invoices found for: ${candidates.join(', ')}`); return; }
        this.http.put(`${this.api}/PodDocuments/${p.id}/link-invoices`, { invoiceIds: ids }).subscribe({
          next: () => {
            const miss = r.unmatched?.length ? ` (not found: ${r.unmatched.join(', ')})` : '';
            this.toast.done(`Linked ${ids.length} invoice(s)${miss}`); this.loadSummary(); this.reload();
          },
          error: (e) => this.toast.error(e?.error?.message || e?.error || "Couldn't link the invoices.")
        });
      },
      error: () => this.toast.error("Couldn't look up those invoice numbers.")
    });
  }
  delinkInvoices(p: Pod): void {
    this.http.put(`${this.api}/PodDocuments/${p.id}/delink-invoice`, {}).subscribe({
      next: () => { this.toast.done('Invoice links removed'); this.loadSummary(); this.reload(); },
      error: () => this.toast.error("Couldn't remove the links.")
    });
  }
  editNotes(p: Pod): void {
    const notes = window.prompt('Notes for this POD:', p.notes ?? '');
    if (notes === null) return;
    this.http.put(`${this.api}/PodDocuments/${p.id}`, { notes }).subscribe({
      next: () => { p.notes = notes; this.toast.done('Notes saved'); },
      error: () => this.toast.error("Couldn't save the notes.")
    });
  }
}
